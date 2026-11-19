import { Injectable } from '@nestjs/common';

interface CompetitorAdapter {
  identifier: string;
  collect(handle: string, token?: string): Promise<Record<string, unknown>>;
}
async function json(url: string, token?: string) {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}
class BlueskyCompetitor implements CompetitorAdapter {
  identifier = 'bluesky';
  async collect(handle: string) {
    const profile = await json(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(
        handle.replace(/^@/, '')
      )}`
    );
    return {
      accountId: profile.did,
      handle: profile.handle,
      name: profile.displayName,
      followers: profile.followersCount,
      following: profile.followsCount,
      posts: profile.postsCount,
      definition:
        'Public profile counts reported by Bluesky at collection time',
    };
  }
}
class YoutubeCompetitor implements CompetitorAdapter {
  identifier = 'youtube';
  async collect(handle: string, token?: string) {
    if (!token)
      throw new Error(
        'Connect a YouTube channel to authorize public channel lookup'
      );
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      ...(/^UC[\w-]{22}$/.test(handle)
        ? { id: handle }
        : { forHandle: handle }),
    });
    const channel = (
      await json(
        `https://www.googleapis.com/youtube/v3/channels?${params}`,
        token
      )
    ).items?.[0];
    if (!channel) throw new Error('Channel was not found');
    return {
      accountId: channel.id,
      name: channel.snippet?.title,
      subscribers: channel.statistics?.hiddenSubscriberCount
        ? null
        : Number(channel.statistics?.subscriberCount),
      views: Number(channel.statistics?.viewCount),
      videos: Number(channel.statistics?.videoCount),
      definition:
        'YouTube public channel totals. Subscriber counts are rounded to three significant figures; hidden totals are unavailable.',
    };
  }
}
@Injectable()
export class CompetitorManager {
  private readonly adapters: CompetitorAdapter[] = [
    new BlueskyCompetitor(),
    new YoutubeCompetitor(),
  ];
  get(identifier: string) {
    return this.adapters.find((adapter) => adapter.identifier === identifier);
  }
}
