import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AgencyAdvertisingRepository } from './advertising.repository';
import { AdvertisingManager } from '@gitroom/nestjs-libraries/integrations/advertising/advertising.manager';
import {
  CampaignInput,
  CampaignUpdate,
} from '@gitroom/nestjs-libraries/integrations/advertising/advertising.interface';
import { EncryptionService } from '@gitroom/nestjs-libraries/services/encryption.service';
import { AddBrandAdAccountDto } from '@gitroom/nestjs-libraries/dtos/agency/advertising.dto';
import { AgencyOperationsRepository } from './operations.repository';
@Injectable()
export class AgencyAdvertisingService {
  constructor(
    private readonly repository: AgencyAdvertisingRepository,
    private readonly manager: AdvertisingManager,
    private readonly encryption: EncryptionService,
    private readonly operations: AgencyOperationsRepository
  ) {}
  list(orgId: string) {
    return this.repository.list(orgId);
  }
  async save(orgId: string, body: AddBrandAdAccountDto) {
    if (!this.encryption.canEncrypt())
      throw new ServiceUnavailableException(
        'Configure token encryption before adding advertising accounts'
      );
    return this.repository.save(orgId, {
      name: body.name,
      provider: body.provider,
      externalId: body.externalId.replace(/-/g, ''),
      token: await this.encryption.encrypt(body.token),
      refreshToken: body.refreshToken
        ? await this.encryption.encrypt(body.refreshToken)
        : null,
      loginAccountId: body.loginAccountId,
    });
  }
  private async connection(orgId: string, id: string) {
    const account = await this.repository.get(orgId, id);
    return { ...account, token: await this.encryption.decrypt(account.token) };
  }
  async sync(orgId: string, id: string) {
    const account = await this.connection(orgId, id);
    try {
      const data = await this.manager.get(account.provider).list(account);
      await this.repository.record(id, JSON.parse(JSON.stringify(data)));
      await this.operations.record(orgId, 'ADVERTISING', 'COMPLETED', {
        accountId: id,
        provider: account.provider,
      });
      return data;
    } catch {
      await this.operations.record(orgId, 'ADVERTISING', 'FAILED', {
        accountId: id,
        provider: account.provider,
      });
      await this.repository.record(
        id,
        {},
        'Check account authorization, API permissions, and token expiry'
      );
      throw new ServiceUnavailableException(
        'Advertising data is unavailable. Reconnect or verify platform access.'
      );
    }
  }
  private writable() {
    if (process.env.ADS_WRITES_ENABLED !== 'true')
      throw new ServiceUnavailableException(
        'Advertising changes are disabled in this environment'
      );
  }
  async create(orgId: string, id: string, body: CampaignInput) {
    this.writable();
    const account = await this.connection(orgId, id);
    return this.manager.get(account.provider).create(account, body);
  }
  async update(
    orgId: string,
    id: string,
    campaignId: string,
    body: CampaignUpdate
  ) {
    this.writable();
    const account = await this.connection(orgId, id);
    const adapter = this.manager.get(account.provider);
    const current = await adapter.list(account);
    if (
      !current.campaigns.some((campaign) => String(campaign.id) === campaignId)
    )
      throw new BadRequestException(
        'Campaign does not belong to the selected advertising account'
      );
    return adapter.update(account, campaignId, body);
  }
}
