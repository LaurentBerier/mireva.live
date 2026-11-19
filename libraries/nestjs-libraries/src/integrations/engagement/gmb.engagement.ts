import {
  EngagementAdapter,
  InboxReadContext,
  InboxThread,
  messageDate,
  readProviderJson,
} from './engagement.interface';
export class GmbEngagementAdapter implements EngagementAdapter {
  async read(context: InboxReadContext) {
    if (
      !/^accounts\/[\w-]+\/locations\/[\w-]+$/.test(
        context.integration.internalId
      )
    )
      throw new Error(
        'The Business Profile connection has no account/location resource name'
      );
    const result = await readProviderJson(
      `https://mybusiness.googleapis.com/v4/${context.integration.internalId}/reviews?pageSize=50&orderBy=updateTime%20desc`,
      { Authorization: `Bearer ${context.integration.token}` }
    );
    const threads: InboxThread[] = (result.reviews || []).map(
      (review: any) => ({
        id: `REVIEW:${review.name}`,
        kind: 'REVIEW',
        title: `${review.starRating} review`,
        messages: [
          {
            id: review.reviewId,
            author: review.reviewer?.displayName || 'Customer',
            content: review.comment || review.starRating,
            createdAt: messageDate(review.createTime),
            direction: 'INBOUND',
          },
          ...(review.reviewReply
            ? [
                {
                  id: `reply:${review.reviewId}`,
                  author: 'Brand',
                  content: review.reviewReply.comment,
                  createdAt: messageDate(review.reviewReply.updateTime),
                  direction: 'OUTBOUND',
                },
              ]
            : []),
        ],
      })
    );
    return { threads, warnings: [] };
  }
  async reply(
    context: InboxReadContext,
    thread: { externalId: string },
    _target: unknown,
    text: string
  ) {
    const name = thread.externalId.slice('REVIEW:'.length);
    if (!/^accounts\/[\w-]+\/locations\/[\w-]+\/reviews\/[\w-]+$/.test(name))
      throw new Error('Invalid review resource');
    await readProviderJson(
      `https://mybusiness.googleapis.com/v4/${name}/reply`,
      { Authorization: `Bearer ${context.integration.token}` },
      { comment: text },
      'PUT'
    );
    return `reply:${name.split('/').pop()}`;
  }
}
