import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { AgencyInboxRepository } from './inbox.repository';
import { EngagementManager } from '@gitroom/nestjs-libraries/integrations/engagement/engagement.manager';
import { IntegrationService } from '../integrations/integration.service';
import {
  InboxReadContext,
  InboxThread,
  messageDate,
} from '@gitroom/nestjs-libraries/integrations/engagement/engagement.interface';
import { CreateBrandFlowDto } from '@gitroom/nestjs-libraries/dtos/agency/inbox.dto';
import { AgencyOperationsRepository } from './operations.repository';

@Injectable()
export class AgencyInboxService {
  constructor(
    private readonly repository: AgencyInboxRepository,
    private readonly manager: EngagementManager,
    private readonly integrations: IntegrationService,
    private readonly operations: AgencyOperationsRepository
  ) {}
  list(orgId: string) {
    return this.repository.list(orgId);
  }
  staff(orgId: string) {
    return this.repository.staff(orgId);
  }
  async context(
    orgId: string,
    integrationId: string
  ): Promise<InboxReadContext> {
    const integration = await this.integrations.getIntegrationById(
      orgId,
      integrationId
    );
    if (!integration || integration.disabled || integration.refreshNeeded)
      throw new BadRequestException(
        'Reconnect this profile before using engagement tools'
      );
    return {
      integration: await this.integrations.decryptTokens(integration),
      publishedIds: (await this.repository.publishedIds(orgId, integrationId))
        .map((post) => post.releaseId!)
        .filter((id) => id !== 'missing'),
    };
  }
  async sync(orgId: string) {
    const results: {
      integrationId: string;
      status: string;
      warnings?: string[];
    }[] = [];
    for (const connection of await this.repository.connections(orgId)) {
      const adapter = this.manager.get(connection.providerIdentifier);
      if (!adapter) {
        results.push({ integrationId: connection.id, status: 'unsupported' });
        continue;
      }
      try {
        const context = await this.context(orgId, connection.id);
        const result = await adapter.read(context);
        for (const thread of result.threads) {
          const id = await this.repository.ingest(
            orgId,
            connection.id,
            connection.providerIdentifier,
            thread
          );
          await this.runFlows(orgId, id, context);
        }
        results.push({
          integrationId: connection.id,
          status: result.warnings.length ? 'partial' : 'synced',
          warnings: result.warnings,
        });
      } catch {
        results.push({
          integrationId: connection.id,
          status: 'access_required',
          warnings: [
            'Check engagement permissions, account eligibility, and platform review',
          ],
        });
      }
    }
    await this.operations.record(
      orgId,
      'ENGAGEMENT',
      !results.length
        ? 'NO_CONNECTIONS'
        : results.some((result) => result.status === 'access_required')
        ? 'PARTIAL'
        : 'COMPLETED',
      { results }
    );
    return { results };
  }
  private mutationsEnabled() {
    if (process.env.ENGAGEMENT_ENABLED !== 'true')
      throw new ServiceUnavailableException(
        'Replies and DM automation are disabled in this environment'
      );
  }
  async reply(
    orgId: string,
    conversationId: string,
    text: string,
    requestId: string,
    author: string
  ) {
    this.mutationsEnabled();
    const conversation = await this.repository.conversation(
      orgId,
      conversationId
    );
    const requestKey = createHash('sha256')
      .update(`${orgId}:${conversationId}:${requestId}`)
      .digest('hex');
    const existing = await this.repository.pendingMessage(requestKey);
    if (existing) {
      if (existing.deliveryStatus === 'SENT') return existing;
      throw new ConflictException(
        'This reply was already attempted. Check the native conversation before sending it again.'
      );
    }
    const target = conversation.messages.find(
      (message) => message.direction === 'INBOUND'
    );
    if (!target)
      throw new BadRequestException('No incoming message is available');
    const adapter = this.manager.get(conversation.provider);
    if (!adapter)
      throw new BadRequestException('Replies are unavailable for this network');
    const pending = await this.repository.beginReply(
      conversation.id,
      requestKey,
      text,
      author
    );
    try {
      const externalId = await adapter.reply(
        await this.context(orgId, conversation.integrationId),
        conversation,
        target,
        text
      );
      if (!externalId)
        throw new Error('Provider did not return a confirmation identifier');
      return this.repository.finishReply(pending.id, externalId, 'SENT');
    } catch (error) {
      // Never automatically retry an irreversible message whose outcome may be unknown.
      await this.repository.finishReply(pending.id, undefined, 'UNKNOWN');
      throw new ServiceUnavailableException(
        'Reply delivery could not be confirmed. Check the native inbox before trying again.'
      );
    }
  }
  assign(
    orgId: string,
    id: string,
    assignedTo?: string | null,
    status?: string
  ) {
    return this.repository.assign(orgId, id, assignedTo, status);
  }
  savedReplies(orgId: string) {
    return this.repository.savedReplies(orgId);
  }
  saveReply(orgId: string, title: string, content: string) {
    return this.repository.saveReply(orgId, title, content);
  }
  flows(orgId: string) {
    return this.repository.flows(orgId);
  }
  async createFlow(orgId: string, body: CreateBrandFlowDto) {
    const context = await this.context(orgId, body.integrationId);
    const adapter = this.manager.get(context.integration.providerIdentifier);
    if (!adapter || (body.directReply && !adapter.privateReply))
      throw new BadRequestException(
        'This connection does not support the requested automation action'
      );
    if (!body.publicReply && !body.directReply)
      throw new BadRequestException('Add a public or direct reply');
    return this.repository.createFlow({
      organizationId: orgId,
      integrationId: body.integrationId,
      name: body.name,
      keyword: body.keyword,
      postExternalId: body.postExternalId,
      publicReply: body.publicReply,
      directReply: body.directReply,
      enabled: false,
    });
  }
  updateFlow(orgId: string, id: string, enabled: boolean) {
    if (enabled) this.mutationsEnabled();
    return this.repository.updateFlow(orgId, id, enabled);
  }
  matches(keyword: string, content: string) {
    const escaped = keyword
      .normalize('NFKC')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`,
      'iu'
    ).test(content.normalize('NFKC'));
  }
  private async runFlows(orgId: string, id: string, context: InboxReadContext) {
    if (process.env.ENGAGEMENT_ENABLED !== 'true') return;
    const conversation = await this.repository.conversation(orgId, id);
    if (conversation.kind !== 'COMMENT') return;
    const adapter = this.manager.get(conversation.provider);
    if (!adapter) return;
    for (const flow of await this.repository.matchingFlows(
      orgId,
      context.integration.id
    )) {
      if (
        flow.postExternalId &&
        conversation.postExternalId !== flow.postExternalId
      )
        continue;
      for (const message of conversation.messages) {
        if (
          message.direction !== 'INBOUND' ||
          !message.authorId ||
          message.authorId === context.integration.internalId ||
          message.createdAt < flow.createdAt ||
          !this.matches(flow.keyword, message.content)
        )
          continue;
        if (!(await this.repository.claimFlow(flow.id, message.id))) continue;
        const result: Record<string, string> = {};
        try {
          if (flow.publicReply)
            result.publicReplyId = await adapter.reply(
              context,
              conversation,
              message,
              flow.publicReply
            );
          if (flow.directReply && adapter.privateReply)
            result.directReplyId = await adapter.privateReply(
              context,
              message.externalId,
              flow.directReply
            );
          await this.repository.finishFlow(flow.id, message.id, 'SENT', result);
        } catch {
          await this.repository.finishFlow(
            flow.id,
            message.id,
            'UNKNOWN',
            result,
            'A provider action could not be confirmed. Inspect the native conversation before repeating it.'
          );
        }
      }
    }
  }
  async metaWebhook(body: any) {
    for (const entry of body.entry || []) {
      const connections = await this.repository.webhookConnections(
        String(entry.id)
      );
      for (const connection of connections)
        for (const event of entry.messaging || []) {
          if (!event.message?.mid || typeof event.message.text !== 'string')
            continue;
          const thread: InboxThread = {
            id: `DM:${
              event.sender?.id === connection.internalId
                ? event.recipient?.id
                : event.sender?.id
            }`,
            kind: 'DM',
            title: 'Direct message',
            messages: [
              {
                id: event.message.mid,
                author: 'Social account',
                authorId: event.sender?.id,
                content: event.message.text,
                createdAt: messageDate(event.timestamp),
                direction: event.message.is_echo ? 'OUTBOUND' : 'INBOUND',
              },
            ],
          };
          await this.repository.ingest(
            connection.organizationId,
            connection.id,
            connection.providerIdentifier,
            thread
          );
        }
      // Comment webhooks trigger an authenticated incremental sync so the provider,
      // rather than an unsigned request field, supplies the message and account IDs.
      if (
        entry.changes?.some((change: any) =>
          ['feed', 'comments'].includes(change.field)
        )
      ) {
        for (const orgId of new Set(
          connections.map((connection) => connection.organizationId)
        ))
          await this.sync(orgId);
      }
    }
    return { received: true };
  }
}
