import {
  EngagementAdapter,
  InboxReadContext,
  InboxThread,
  messageDate,
  readProviderJson,
} from './engagement.interface';
export class YoutubeEngagementAdapter implements EngagementAdapter {
  async read(context: InboxReadContext) {
    const data = await readProviderJson(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${encodeURIComponent(
        context.integration.internalId
      )}&maxResults=100&order=time`,
      { Authorization: `Bearer ${context.integration.token}` }
    );
    const threads: InboxThread[] = (data.items || []).map((item: any) => ({
      id: `COMMENT:${item.snippet.topLevelComment.id}`,
      kind: 'COMMENT',
      postExternalId: item.snippet.videoId,
      title: item.snippet.videoId || 'YouTube comments',
      messages: [
        item.snippet.topLevelComment,
        ...(item.replies?.comments || []),
      ].map((comment: any) => ({
        id: comment.id,
        author: comment.snippet.authorDisplayName || 'YouTube viewer',
        authorId: comment.snippet.authorChannelId?.value,
        content:
          comment.snippet.textOriginal || comment.snippet.textDisplay || '',
        createdAt: messageDate(comment.snippet.publishedAt),
        direction:
          comment.snippet.authorChannelId?.value ===
          context.integration.internalId
            ? 'OUTBOUND'
            : 'INBOUND',
      })),
    }));
    return { threads, warnings: [] };
  }
  async reply(
    context: InboxReadContext,
    thread: { externalId: string },
    _target: unknown,
    text: string
  ) {
    const result = await readProviderJson(
      'https://www.googleapis.com/youtube/v3/comments?part=snippet',
      { Authorization: `Bearer ${context.integration.token}` },
      {
        snippet: {
          parentId: thread.externalId.slice('COMMENT:'.length),
          textOriginal: text,
        },
      }
    );
    return result.id;
  }
}
