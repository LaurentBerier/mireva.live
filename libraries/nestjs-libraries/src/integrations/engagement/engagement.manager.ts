import { Injectable } from '@nestjs/common';
import { EngagementAdapter } from './engagement.interface';
import { MetaEngagementAdapter } from './meta.engagement';
import { YoutubeEngagementAdapter } from './youtube.engagement';
import { XEngagementAdapter } from './x.engagement';
import { TiktokBusinessEngagementAdapter } from './tiktok.engagement';
import { LinkedinEngagementAdapter } from './linkedin.engagement';
import { GmbEngagementAdapter } from './gmb.engagement';
@Injectable()
export class EngagementManager {
  private readonly adapters: Record<string, EngagementAdapter> = {
    facebook: new MetaEngagementAdapter(),
    instagram: new MetaEngagementAdapter(true),
    'instagram-standalone': new MetaEngagementAdapter(true, true),
    youtube: new YoutubeEngagementAdapter(),
    x: new XEngagementAdapter(),
    'tiktok-business': new TiktokBusinessEngagementAdapter(),
    linkedin: new LinkedinEngagementAdapter(),
    'linkedin-page': new LinkedinEngagementAdapter(),
    gmb: new GmbEngagementAdapter(),
  };
  get(identifier: string) {
    return this.adapters[identifier];
  }
}
