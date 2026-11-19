import {
  EngagementAdapter,
  InboxReadContext,
  InboxThread,
  messageDate,
  readProviderJson,
} from './engagement.interface';

export class MetaEngagementAdapter implements EngagementAdapter {
  constructor(
    private readonly instagram = false,
    private readonly standalone = false
  ) {}
  private base() {
    return `https://${
      this.standalone ? 'graph.instagram.com' : 'graph.facebook.com'
    }/${process.env.GRAPH_API_VERSION || 'v27.0'}`;
  }
  private call(context: InboxReadContext, path: string, body?: unknown) {
    return readProviderJson(
      `${this.base()}/${path}`,
      { Authorization: `Bearer ${context.integration.token}` },
      body
    );
  }
  async read(context: InboxReadContext) {
    const id = encodeURIComponent(context.integration.internalId);
    const dm = async (): Promise<InboxThread[]> => {
      const list = await this.call(
        context,
        `${id}/conversations?limit=100${
          this.instagram && !this.standalone ? '&platform=instagram' : ''
        }&fields=id,participants,messages.limit(100){id,from,message,created_time}`
      );
      return (list.data || []).map((conversation: any) => ({
        id: `DM:${
          (conversation.participants?.data || []).find(
            (person: any) => person.id !== context.integration.internalId
          )?.id || conversation.id
        }`,
        kind: 'DM',
        title:
          (conversation.participants?.data || [])
            .map((person: any) => person.name || person.username || person.id)
            .join(', ') || 'Direct message',
        messages: (conversation.messages?.data || []).map((message: any) => ({
          id: message.id,
          author:
            message.from?.name || message.from?.username || 'Social account',
          authorId: message.from?.id,
          content: message.message || '',
          createdAt: messageDate(message.created_time),
          direction:
            message.from?.id === context.integration.internalId
              ? 'OUTBOUND'
              : 'INBOUND',
        })),
      }));
    };
    const comments = async (): Promise<InboxThread[]> => {
      const fields = this.instagram
        ? 'id,caption,comments.limit(100){id,text,username,timestamp,from,replies.limit(100){id,text,username,timestamp,from}}'
        : 'id,message,comments.limit(100){id,from,message,created_time,comments.limit(100){id,from,message,created_time}}';
      const list = await this.call(
        context,
        `${id}/${
          this.instagram ? 'media' : 'published_posts'
        }?limit=50&fields=${encodeURIComponent(fields)}`
      );
      return (list.data || []).flatMap((post: any) =>
        (post.comments?.data || []).map((comment: any) => ({
          id: `COMMENT:${comment.id}`,
          kind: 'COMMENT',
          postExternalId: post.id,
          title: post.caption || post.message || 'Post comment',
          messages: [
            comment,
            ...((this.instagram ? comment.replies : comment.comments)?.data ||
              []),
          ].map((message: any) => ({
            id: message.id,
            author: message.from?.name || message.username || 'Social account',
            authorId: message.from?.id,
            content: message.text || message.message || '',
            createdAt: messageDate(message.timestamp || message.created_time),
            direction:
              message.from?.id === context.integration.internalId
                ? 'OUTBOUND'
                : 'INBOUND',
          })),
        }))
      );
    };
    const results = await Promise.allSettled([dm(), comments()]);
    return {
      threads: results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      ),
      warnings: results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [
              `${
                index ? 'Comments' : 'Messages'
              } unavailable: verify permissions and app review`,
            ]
          : []
      ),
    };
  }
  async reply(
    context: InboxReadContext,
    thread: { externalId: string; kind: string },
    target: { externalId: string; authorId?: string },
    text: string
  ) {
    if (thread.kind === 'DM') {
      if (!target.authorId)
        throw new Error('The recipient identifier is unavailable');
      const result = await this.call(
        context,
        `${encodeURIComponent(context.integration.internalId)}/messages`,
        { recipient: { id: target.authorId }, message: { text } }
      );
      return result.message_id || result.id;
    }
    const result = await this.call(
      context,
      `${encodeURIComponent(target.externalId)}/${
        this.instagram ? 'replies' : 'comments'
      }`,
      { message: text }
    );
    return result.id;
  }
  async privateReply(
    context: InboxReadContext,
    commentId: string,
    text: string
  ) {
    const result = await this.call(
      context,
      `${encodeURIComponent(context.integration.internalId)}/messages`,
      { recipient: { comment_id: commentId }, message: { text } }
    );
    return result.message_id || result.id;
  }
}
