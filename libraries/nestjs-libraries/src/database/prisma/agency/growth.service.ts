import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { AgencyGrowthRepository } from './growth.repository';
import { SaveBrandLinkPageDto } from '@gitroom/nestjs-libraries/dtos/agency/growth.dto';

@Injectable()
export class AgencyGrowthService {
  constructor(private readonly repository: AgencyGrowthRepository) {}
  pages(orgId: string) {
    return this.repository.pages(orgId);
  }
  savePage(orgId: string, body: SaveBrandLinkPageDto) {
    if (new Set(body.links.map((link) => link.id)).size !== body.links.length)
      throw new BadRequestException('Link IDs must be unique');
    return this.repository.savePage(orgId, body.id, {
      slug: body.slug,
      title: body.title,
      description: body.description || '',
      theme: body.theme,
      published: body.published,
      links: body.links.map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
      })),
    });
  }
  async publicPage(slug: string) {
    const page = await this.repository.publicPage(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
  async click(slug: string, id: string, referrer?: string) {
    const page = await this.publicPage(slug);
    const link = (page.links as { id: string; url: string }[]).find(
      (link) => link.id === id
    );
    if (!link || !link.url.startsWith('https://'))
      throw new NotFoundException();
    await this.repository.click(page.id, id, this.cleanReferrer(referrer));
    return link.url;
  }
  clickStats(orgId: string, id: string) {
    return this.repository.clickStats(orgId, id);
  }
  async websites(orgId: string) {
    return (await this.repository.websites(orgId)).map((site) => ({
      ...site,
      snippet: `<script defer src="${process.env.FRONTEND_URL}/api/backend/agency-public/tracker.js" data-site="${site.siteKey}"></script>`,
    }));
  }
  createWebsite(orgId: string, domain: string) {
    let hostname: string;
    try {
      hostname = new URL(
        domain.includes('://') ? domain : `https://${domain}`
      ).hostname.toLowerCase();
    } catch {
      throw new BadRequestException('Enter a valid website hostname');
    }
    if (!hostname || hostname.length > 253)
      throw new BadRequestException('Enter a valid website hostname');
    return this.repository.createWebsite(orgId, hostname);
  }
  async track(
    siteKey: string,
    body: { pathname: string; referrer?: string },
    origin: string,
    ip: string,
    userAgent: string,
    country?: string
  ) {
    const site = await this.repository.website(siteKey);
    if (!site?.enabled) throw new NotFoundException();
    try {
      if (new URL(origin).hostname.toLowerCase() !== site.domain)
        throw new Error();
    } catch {
      throw new BadRequestException(
        'Website origin does not match this tracker'
      );
    }
    const pathname = body.pathname.split(/[?#]/)[0];
    if (!pathname.startsWith('/') || pathname.length > 2048)
      throw new BadRequestException('Invalid page path');
    const secret = process.env.TRACKER_HASH_SECRET || process.env.JWT_SECRET;
    if (!secret)
      throw new BadRequestException('Website measurement is not configured');
    const visitorKey = createHmac('sha256', secret)
      .update(
        [site.id, new Date().toISOString().slice(0, 10), ip, userAgent].join(
          '|'
        )
      )
      .digest('hex');
    await this.repository.visit({
      websiteId: site.id,
      pathname,
      visitorKey,
      referrer: this.cleanReferrer(body.referrer),
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    });
    return { accepted: true };
  }
  async stats(orgId: string) {
    const rows = await this.repository.stats(orgId);
    const recent = rows.filter(
      (row) => +row.createdAt > Date.now() - 30 * 60_000
    );
    const countBy = (key: 'pathname' | 'country' | 'referrer') =>
      [
        ...rows.reduce(
          (map, row) =>
            map.set(
              row[key] || 'Unknown',
              (map.get(row[key] || 'Unknown') || 0) + 1
            ),
          new Map<string, number>()
        ),
      ]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
    return {
      views: rows.length,
      visitors: new Set(rows.map((row) => row.visitorKey)).size,
      realtimeVisitors: new Set(recent.map((row) => row.visitorKey)).size,
      pages: countBy('pathname'),
      countries: countBy('country'),
      referrers: countBy('referrer'),
      days: 30,
    };
  }
  trackerScript() {
    const endpoint = `${process.env.FRONTEND_URL}/api/backend/agency-public/track/`;
    return `(()=>{const s=document.currentScript,k=s&&s.dataset.site;if(!k)return;const send=()=>navigator.sendBeacon(${JSON.stringify(
      endpoint
    )}+encodeURIComponent(k),new Blob([JSON.stringify({pathname:location.pathname,referrer:document.referrer})],{type:'text/plain'}));send();let p=location.pathname;setInterval(()=>{if(location.pathname!==p){p=location.pathname;send()}},1500)})();`;
  }
  private cleanReferrer(value?: string) {
    try {
      const url = new URL(value || '');
      return ['https:', 'http:'].includes(url.protocol)
        ? url.origin + url.pathname
        : undefined;
    } catch {
      return undefined;
    }
  }
}
