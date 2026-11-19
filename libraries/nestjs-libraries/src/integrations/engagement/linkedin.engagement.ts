import {
  EngagementAdapter,
  InboxReadContext,
  InboxThread,
  messageDate,
  readProviderJson,
} from './engagement.interface';
export class LinkedinEngagementAdapter implements EngagementAdapter {
  private headers(context: InboxReadContext) {
    return {
      Authorization: `Bearer ${context.integration.token}`,
      'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202608',
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }
  async read(context: InboxReadContext) {
    const threads: InboxThread[] = [];
    for (const urn of context.publishedIds.slice(0, 100)) {
      const data = await readProviderJson(
        `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(
          urn
        )}/comments?count=100`,
        this.headers(context)
      );
      for (const comment of data.elements || [])
        threads.push({
          id: `COMMENT:${urn}`,
          kind: 'COMMENT',
          postExternalId: urn,
          title: 'LinkedIn post comments',
          messages: [
            {
              id: String(comment.id),
              author: comment.actor || 'LinkedIn member',
              authorId: comment.actor,
              content: comment.message?.text || '',
              createdAt: messageDate(comment.created?.time),
              direction: 'INBOUND',
            },
          ],
        });
    }
    return {
      threads,
      warnings: context.publishedIds.length
        ? []
        : ['No tracked post URNs are available yet'],
    };
  }
  async reply(
    context: InboxReadContext,
    thread: { externalId: string },
    target: { externalId: string },
    text: string
  ) {
    const urn = thread.externalId.slice('COMMENT:'.length);
    const actor =
      context.integration.providerIdentifier === 'linkedin-page'
        ? `urn:li:organization:${context.integration.internalId}`
        : `urn:li:person:${context.integration.internalId}`;
    const data = await readProviderJson(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(
        urn
      )}/comments`,
      this.headers(context),
      {
        actor,
        object: urn,
        parentComment: `urn:li:comment:(${urn},${target.externalId})`,
        message: { text },
      }
    );
    return String(data.id);
  }
}
