import {
  EngagementAdapter,
  InboxReadContext,
  InboxThread,
  messageDate,
  readProviderJson,
} from './engagement.interface';
export class TiktokBusinessEngagementAdapter implements EngagementAdapter {
  private call(context: InboxReadContext, path: string, body?: unknown) {
    return readProviderJson(
      `https://business-api.tiktok.com/open_api/v1.3/${path}`,
      { 'Access-Token': context.integration.token },
      body
    );
  }
  async read(context: InboxReadContext) {
    const threads: InboxThread[] = [];
    for (const videoId of context.publishedIds.slice(0, 100)) {
      const result = await this.call(
        context,
        `business/comment/list/?business_id=${encodeURIComponent(
          context.integration.internalId
        )}&video_id=${encodeURIComponent(videoId)}`
      );
      for (const comment of result.data?.comments || [])
        threads.push({
          id: `COMMENT:${videoId}:${comment.comment_id}`,
          kind: 'COMMENT',
          postExternalId: videoId,
          title: `TikTok video ${videoId}`,
          messages: [
            {
              id: comment.comment_id,
              author:
                comment.user?.display_name ||
                comment.user?.username ||
                'TikTok viewer',
              authorId: comment.user?.open_id,
              content: comment.text || '',
              createdAt: messageDate(comment.create_time),
              direction: 'INBOUND',
            },
          ],
        });
    }
    return {
      threads,
      warnings: context.publishedIds.length
        ? []
        : ['No tracked video identifiers are available yet'],
    };
  }
  async reply(
    context: InboxReadContext,
    thread: { externalId: string },
    target: { externalId: string },
    text: string
  ) {
    const [, videoId] = thread.externalId.split(':');
    const result = await this.call(context, 'business/comment/reply/create/', {
      business_id: context.integration.internalId,
      video_id: videoId,
      comment_id: target.externalId,
      text,
    });
    return result.data?.comment_id;
  }
}
