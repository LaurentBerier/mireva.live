import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { createHash, randomUUID } from 'crypto';
import { AgencyImportRepository } from './import.repository';
import { PostsService } from '../posts/posts.service';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';

@Injectable()
export class AgencyImportService {
  constructor(
    private readonly repository: AgencyImportRepository,
    private readonly posts: PostsService
  ) {}
  async preview(orgId: string, csv: string) {
    let rows: Record<string, string>[];
    try {
      rows = parse(csv, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        max_record_size: 100000,
        to: 501,
        trim: true,
      });
    } catch {
      throw new BadRequestException(
        'Use a valid quoted CSV with channel_id,publish_at,content,media_ids,settings_json,repeat_days headers'
      );
    }
    if (!rows.length || rows.length > 500)
      throw new BadRequestException('Import between 1 and 500 rows at a time');
    const connections = await this.repository.connections(orgId);
    return Promise.all(
      rows.map(async (row, index) => {
        const errors: string[] = [];
        const connection = connections.find(
          (item) => item.id === row.channel_id
        );
        if (!connection)
          errors.push('Choose a connected channel from this brand');
        if (
          !row.publish_at ||
          !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.publish_at) ||
          !Number.isFinite(+new Date(row.publish_at)) ||
          new Date(row.publish_at) <= new Date()
        )
          errors.push(
            'Use a future ISO timestamp with Z or an explicit UTC offset'
          );
        const ids = (row.media_ids || '').split('|').filter(Boolean);
        const found = await this.repository.media(orgId, ids);
        const media = ids
          .map((id) => found.find((asset) => asset.id === id))
          .filter((asset): asset is NonNullable<typeof asset> => !!asset);
        if (new Set(ids).size !== media.length)
          errors.push('All media IDs must be ready files in this brand');
        let settings: Record<string, unknown> = {};
        try {
          settings = row.settings_json ? JSON.parse(row.settings_json) : {};
          if (
            !settings ||
            Array.isArray(settings) ||
            typeof settings !== 'object'
          )
            throw new Error();
        } catch {
          errors.push('settings_json must contain a JSON object');
          settings = {};
        }
        const repeatDays = row.repeat_days
          ? Number(row.repeat_days)
          : undefined;
        if (
          repeatDays !== undefined &&
          (!Number.isInteger(repeatDays) || repeatDays < 1 || repeatDays > 366)
        )
          errors.push('repeat_days must be a whole number from 1 to 366');
        const content = sanitizePostContent(row.content || '');
        if (!content.trim() && !media.length)
          errors.push('Add content or media');
        if (content.length > 100000) errors.push('Content is too long');
        return {
          row: index + 2,
          channelId: row.channel_id,
          channelName: connection?.name,
          provider: connection?.providerIdentifier,
          publishAt: row.publish_at,
          content,
          media,
          settings: { ...settings, __type: connection?.providerIdentifier },
          repeatDays,
          errors,
        };
      })
    );
  }
  async commit(orgId: string, requestId: string, csv: string) {
    const fingerprint = createHash('sha256').update(csv).digest('hex');
    const previous = await this.repository.previous(orgId, requestId);
    if (previous && previous.fingerprint !== fingerprint)
      throw new ConflictException(
        'This import ID was used for a different CSV'
      );
    if (previous?.state === 'COMPLETED') return previous.results;
    const rows = await this.preview(orgId, csv);
    if (rows.some((row) => row.errors.length))
      throw new BadRequestException(
        'Fix every validation error before importing'
      );
    const owner = randomUUID();
    const { record, cached } = await this.repository.begin(
      orgId,
      requestId,
      fingerprint,
      owner
    );
    if (cached) return record.results;
    const results: { row: number; postId: string }[] = [];
    try {
      for (const row of rows) {
        await this.repository.renew(record.id, owner);
        const id = createHash('sha256')
          .update(`${orgId}:${requestId}:${row.row}`)
          .digest('hex')
          .slice(0, 32);
        if (!(await this.repository.existing(orgId, id))) {
          await this.posts.createPost(
            orgId,
            {
              type: 'draft',
              shortLink: false,
              date: row.publishAt,
              tags: [],
              inter: row.repeatDays,
              posts: [
                {
                  group: '',
                  integration: { id: row.channelId },
                  settings: row.settings as any,
                  value: [
                    {
                      id,
                      content: row.content,
                      delay: 0,
                      image: row.media.map((asset) => ({
                        id: asset.id,
                        path: asset.path,
                        ...(asset.alt ? { alt: asset.alt } : {}),
                        ...(asset.thumbnail
                          ? { thumbnail: asset.thumbnail }
                          : {}),
                      })),
                    },
                  ],
                },
              ],
            },
            'WEB',
            false,
            { id: record.id, owner }
          );
        }
        results.push({ row: row.row, postId: id });
      }
      await this.repository.finish(record.id, owner, 'COMPLETED', results);
      return results;
    } catch (error) {
      await this.repository
        .finish(record.id, owner, 'FAILED', results)
        .catch(() => {});
      throw error;
    }
  }
  history(orgId: string) {
    return this.repository.history(orgId);
  }
}
