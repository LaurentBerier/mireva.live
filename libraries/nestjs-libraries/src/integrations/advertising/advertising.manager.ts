import { Injectable } from '@nestjs/common';
import { AdvertisingAdapter } from './advertising.interface';
import { MetaAdvertisingAdapter } from './meta.advertising';
import { GoogleAdvertisingAdapter } from './google.advertising';
import { TiktokAdvertisingAdapter } from './tiktok.advertising';
@Injectable()
export class AdvertisingManager {
  private readonly adapters: Record<string, AdvertisingAdapter> = {
    meta: new MetaAdvertisingAdapter(),
    google: new GoogleAdvertisingAdapter(),
    tiktok: new TiktokAdvertisingAdapter(),
  };
  get(provider: string) {
    return this.adapters[provider];
  }
}
