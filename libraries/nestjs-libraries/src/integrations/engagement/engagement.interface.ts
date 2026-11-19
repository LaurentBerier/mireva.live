import { Integration } from '@prisma/client';
export type InboxMessage = {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  createdAt: Date;
  direction: 'INBOUND' | 'OUTBOUND';
};
export type InboxThread = {
  id: string;
  kind: 'COMMENT' | 'DM' | 'REVIEW' | 'MENTION';
  title: string;
  postExternalId?: string;
  messages: InboxMessage[];
};
export type InboxReadContext = {
  integration: Integration;
  publishedIds: string[];
};
export interface EngagementAdapter {
  read(
    context: InboxReadContext
  ): Promise<{ threads: InboxThread[]; warnings: string[] }>;
  reply(
    context: InboxReadContext,
    thread: { externalId: string; kind: string },
    target: { externalId: string; authorId?: string },
    text: string
  ): Promise<string>;
  privateReply?(
    context: InboxReadContext,
    commentId: string,
    text: string
  ): Promise<string>;
}
export async function readProviderJson(
  url: string,
  headers: Record<string, string>,
  body?: unknown,
  method?: string
): Promise<any> {
  const response = await fetch(url, {
    headers: {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    method: method || (body ? 'POST' : 'GET'),
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`Provider request failed (HTTP ${response.status})`);
  const text = await response.text();
  const data = text
    ? JSON.parse(text)
    : {
        id:
          response.headers.get('x-restli-id') ||
          response.headers.get('location'),
      };
  if (data.error || (typeof data.code === 'number' && data.code !== 0))
    throw new Error('Provider access or validation failed');
  return data;
}
export function messageDate(value: string | number) {
  const date = new Date(
    typeof value === 'number' && value < 100000000000 ? value * 1000 : value
  );
  return Number.isFinite(+date) ? date : new Date(0);
}
