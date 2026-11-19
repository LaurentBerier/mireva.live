import { TwitterApi } from 'twitter-api-v2';
import {
  EngagementAdapter,
  InboxReadContext,
  InboxThread,
  messageDate,
} from './engagement.interface';
export class XEngagementAdapter implements EngagementAdapter {
  private client(context: InboxReadContext) {
    const [accessToken, accessSecret] = context.integration.token.split(':');
    return accessSecret
      ? new TwitterApi({
          appKey: process.env.X_API_KEY!,
          appSecret: process.env.X_API_SECRET!,
          accessToken,
          accessSecret,
        })
      : new TwitterApi(accessToken);
  }
  async read(context: InboxReadContext) {
    const result: any = await this.client(context).v2.get('dm_events', {
      max_results: 100,
      'dm_event.fields': 'id,text,sender_id,dm_conversation_id,created_at',
    });
    const threads = new Map<string, InboxThread>();
    for (const event of result.data || []) {
      const id = `DM:${event.dm_conversation_id}`;
      const thread = threads.get(id) || {
        id,
        kind: 'DM' as const,
        title: 'X direct message',
        messages: [],
      };
      thread.messages.push({
        id: event.id,
        author: event.sender_id,
        authorId: event.sender_id,
        content: event.text || '',
        createdAt: messageDate(event.created_at),
        direction:
          event.sender_id === context.integration.internalId
            ? 'OUTBOUND'
            : 'INBOUND',
      });
      threads.set(id, thread);
    }
    return { threads: [...threads.values()], warnings: [] };
  }
  async reply(
    context: InboxReadContext,
    _thread: unknown,
    target: { authorId?: string },
    text: string
  ) {
    if (!target.authorId) throw new Error('Recipient unavailable');
    const result: any = await this.client(context).v2.post(
      `dm_conversations/with/${encodeURIComponent(target.authorId)}/messages`,
      { text }
    );
    return result.data?.dm_event_id;
  }
}
