import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AgencyAnalyticsRepository } from './analytics.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { IntegrationService } from '../integrations/integration.service';
import { PostsService } from '../posts/posts.service';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { CompetitorManager } from '@gitroom/nestjs-libraries/integrations/competitors/competitor.manager';
import { AgencyOperationsRepository } from './operations.repository';

@Injectable()
export class AgencyAnalyticsService {
  constructor(
    private readonly repository: AgencyAnalyticsRepository,
    private readonly integrations: IntegrationService,
    private readonly manager: IntegrationManager,
    private readonly postsService: PostsService,
    private readonly ai: OpenaiService,
    private readonly competitors: CompetitorManager,
    private readonly operations: AgencyOperationsRepository
  ) {}

  range(from?: string, to?: string) {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - 30 * 86400000);
    if (
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      start > end ||
      +end - +start > 366 * 86400000
    )
      throw new BadRequestException('Choose a valid range of at most 366 days');
    return { from: start, to: end };
  }

  async sync(org: Organization) {
    const connections = await this.repository.connections(org.id);
    const results: { id: string; status: string; reason?: string }[] = [];
    for (const connection of connections) {
      const provider = this.manager.getSocialIntegration(
        connection.providerIdentifier
      );
      if (connection.refreshNeeded || !provider?.analytics) {
        results.push({
          id: connection.id,
          status: 'unavailable',
          reason: connection.refreshNeeded
            ? 'Reconnect this profile'
            : 'Account metrics are not exposed by this adapter',
        });
        continue;
      }
      try {
        const series = await this.integrations.checkAnalytics(
          org,
          connection.id,
          '30'
        );
        await this.storeSeries(
          org.id,
          connection.id,
          connection.providerIdentifier,
          '',
          series
        );
        results.push({
          id: connection.id,
          status: series.length ? 'synced' : 'no_data',
        });
      } catch {
        results.push({
          id: connection.id,
          status: 'failed',
          reason:
            'The provider rejected the analytics request. Check connection scopes and access.',
        });
      }
    }
    const { from, to } = this.range();
    for (const post of await this.repository.posts(org.id, from, to)) {
      if (
        !this.manager.getSocialIntegration(post.integration.providerIdentifier)
          ?.postAnalytics
      )
        continue;
      try {
        const series = await this.postsService.checkPostAnalytics(
          org.id,
          post.id,
          30
        );
        if (Array.isArray(series))
          await this.storeSeries(
            org.id,
            post.integrationId,
            post.integration.providerIdentifier,
            post.id,
            series
          );
      } catch {
        /* One unavailable post must not discard successful account syncs. */
      }
    }
    for (const competitor of await this.repository.competitors(org.id)) {
      const adapter = this.competitors.get(competitor.provider);
      if (!adapter) {
        await this.repository.updateCompetitor(competitor.id, {
          error:
            'Public competitor metrics are pending an approved provider adapter',
        });
        continue;
      }
      try {
        const connection = connections.find(
          (item) => item.providerIdentifier === competitor.provider
        );
        const credentials = connection
          ? await this.integrations.getIntegrationById(org.id, connection.id)
          : undefined;
        const data = await adapter.collect(
          competitor.handle,
          credentials?.token
        );
        await this.repository.updateCompetitor(competitor.id, {
          data: JSON.parse(JSON.stringify(data)),
          collectedAt: new Date(),
          error: null,
        });
      } catch (error) {
        await this.repository.updateCompetitor(competitor.id, {
          error: error instanceof Error ? error.message : 'Collection failed',
        });
      }
    }
    await this.operations.record(
      org.id,
      'ANALYTICS',
      !results.length
        ? 'NO_CONNECTIONS'
        : results.some((result) => result.status === 'failed')
        ? 'PARTIAL'
        : 'COMPLETED',
      { results }
    );
    return { results, collectedAt: new Date().toISOString() };
  }

  private async storeSeries(
    orgId: string,
    integrationId: string,
    provider: string,
    subjectId: string,
    series: AnalyticsData[]
  ) {
    const rows: Prisma.BrandMetricCreateManyInput[] = [];
    for (const metric of series || [])
      for (const point of metric.data || []) {
        const value = Number(point.total);
        const date = new Date(point.date);
        if (!Number.isFinite(value) || !Number.isFinite(+date)) continue;
        const key = createHash('sha256')
          .update(
            JSON.stringify([
              orgId,
              integrationId,
              subjectId,
              metric.label,
              date.toISOString(),
            ])
          )
          .digest('hex');
        rows.push({
          key,
          organizationId: orgId,
          integrationId,
          provider,
          subjectId,
          metric: metric.label,
          value,
          definition: `${provider}: ${metric.label} as returned by the provider adapter`,
          periodStart: date,
        });
      }
    await this.repository.store(rows);
  }

  async summary(org: Organization, from?: string, to?: string) {
    const range = this.range(from, to);
    const [metrics, connections, posts, competitors] = await Promise.all([
      this.repository.metrics(org.id, range.from, range.to),
      this.repository.connections(org.id),
      this.repository.posts(org.id, range.from, range.to),
      this.repository.competitors(org.id),
    ]);
    const latest = new Map<string, (typeof metrics)[number]>();
    for (const metric of metrics.filter((row) => !row.subjectId))
      latest.set(`${metric.integrationId}:${metric.metric}`, metric);
    const hashtags = new Map<string, number>();
    for (const post of posts)
      for (const tag of new Set(post.content.match(/#[\p{L}\p{N}_]+/gu) || []))
        hashtags.set(
          tag.toLowerCase(),
          (hashtags.get(tag.toLowerCase()) || 0) + 1
        );
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: org.timezoneName,
      weekday: 'short',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const slots = new Map<
      string,
      {
        provider: string;
        weekday: string;
        hour: string;
        posts: number;
        score: number;
      }
    >();
    for (const post of posts) {
      const parts = formatter.formatToParts(post.publishDate);
      const weekday = parts.find((part) => part.type === 'weekday')!.value;
      const hour = parts.find((part) => part.type === 'hour')!.value;
      const postMetrics = metrics.filter(
        (metric) => metric.subjectId === post.id
      );
      const engagement = postMetrics.filter((metric) =>
        /engagement/i.test(metric.metric)
      );
      const scored = engagement.length
        ? engagement
        : postMetrics.filter((metric) =>
            /^(likes|comments|shares|reactions)$/i.test(metric.metric)
          );
      if (!scored.length) continue;
      const recent = new Map<string, number>();
      scored.forEach((metric) => recent.set(metric.metric, metric.value));
      const score = [...recent.values()].reduce((sum, value) => sum + value, 0);
      const key = `${post.integration.providerIdentifier}:${weekday}:${hour}`;
      const slot = slots.get(key) || {
        provider: post.integration.providerIdentifier,
        weekday,
        hour,
        posts: 0,
        score: 0,
      };
      slot.posts++;
      slot.score += score;
      slots.set(key, slot);
    }
    return {
      ...range,
      timezoneName: org.timezoneName,
      metrics,
      latest: [...latest.values()],
      connections,
      competitors,
      hashtags: [...hashtags]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
      bestTimes:
        posts.length < 5
          ? []
          : [...slots.values()]
              .map((slot) => ({
                ...slot,
                averageEngagement: slot.score / slot.posts,
              }))
              .sort((a, b) => b.averageEngagement - a.averageEngagement),
      bestTimesStatus:
        posts.length < 5
          ? 'insufficient_data'
          : slots.size
          ? 'available'
          : 'metrics_unavailable',
      unavailable: connections
        .filter(
          (connection) =>
            !this.manager.getSocialIntegration(connection.providerIdentifier)
              ?.analytics
        )
        .map((connection) => connection.id),
    };
  }
  addCompetitor(orgId: string, provider: string, handle: string) {
    return this.repository.competitor(orgId, provider, handle.trim());
  }
  async createKey(orgId: string) {
    const token = randomBytes(32).toString('base64url');
    const key = await this.repository.createKey(
      orgId,
      createHash('sha256').update(token).digest('hex')
    );
    return { id: key.id, token };
  }
  keys(orgId: string) {
    return this.repository.keys(orgId);
  }
  revokeKey(orgId: string, id: string) {
    return this.repository.revokeKey(orgId, id);
  }
  async connector(authorization: string, from?: string, to?: string) {
    const token = authorization?.match(/^Bearer ([\w-]{43})$/)?.[1];
    if (!token) throw new UnauthorizedException();
    const key = await this.repository.key(
      createHash('sha256').update(token).digest('hex')
    );
    if (!key) throw new UnauthorizedException();
    const range = this.range(from, to);
    const metrics = await this.repository.metrics(
      key.organizationId,
      range.from,
      range.to
    );
    return {
      rows: metrics.map((row) => ({
        date: row.periodStart.toISOString().slice(0, 10).replace(/-/g, ''),
        provider: row.provider,
        channel: row.integrationId,
        post: row.subjectId,
        metric: row.metric,
        value: row.value,
        definition: row.definition,
        collectedAt: row.collectedAt.toISOString(),
      })),
    };
  }
  async analyze(
    org: Organization,
    question: string,
    from?: string,
    to?: string
  ) {
    const summary = await this.summary(org, from, to);
    return {
      analysis: await this.ai.analyzeMetrics(question, {
        from: summary.from,
        to: summary.to,
        latest: summary.latest,
        bestTimes: summary.bestTimes.slice(0, 10),
        unavailable: summary.unavailable,
      }),
      collectedAt: new Date(),
    };
  }
}
