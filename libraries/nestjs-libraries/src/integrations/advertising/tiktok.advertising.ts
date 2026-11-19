import {
  AdvertisingAccount,
  AdvertisingAdapter,
  CampaignInput,
  CampaignUpdate,
} from './advertising.interface';
import { readProviderJson } from '../engagement/engagement.interface';
export class TiktokAdvertisingAdapter implements AdvertisingAdapter {
  private call(account: AdvertisingAccount, path: string, body?: unknown) {
    return readProviderJson(
      `https://business-api.tiktok.com/open_api/v1.3/${path}`,
      { 'Access-Token': account.token },
      body
    );
  }
  async list(account: AdvertisingAccount) {
    const campaigns = await this.call(
      account,
      `campaign/get/?advertiser_id=${encodeURIComponent(
        account.externalId
      )}&page_size=1000`
    );
    const end = new Date(),
      start = new Date(end.getTime() - 29 * 86400000);
    const query = new URLSearchParams({
      advertiser_id: account.externalId,
      report_type: 'BASIC',
      data_level: 'AUCTION_CAMPAIGN',
      dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks']),
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      page_size: '1000',
    });
    const report = await this.call(account, `report/integrated/get/?${query}`);
    return {
      campaigns: (campaigns.data?.list || []).map((row: any) => ({
        ...row,
        id: row.campaign_id,
        name: row.campaign_name,
        status: row.operation_status,
      })),
      performance: report.data?.list || [],
    };
  }
  async create(account: AdvertisingAccount, input: CampaignInput) {
    if (input.objective !== 'TRAFFIC')
      throw new Error(
        'This creation form supports Manual traffic campaigns; other objectives and Smart+ use their native creation workflow'
      );
    const result = await this.call(account, 'campaign/create/', {
      advertiser_id: account.externalId,
      campaign_name: input.name,
      objective_type: 'TRAFFIC',
      budget_mode: 'BUDGET_MODE_DAY',
      budget: input.dailyBudget,
      operation_status: 'DISABLE',
    });
    return { id: result.data.campaign_id };
  }
  async update(account: AdvertisingAccount, id: string, input: CampaignUpdate) {
    if (input.status)
      await this.call(account, 'campaign/status/update/', {
        advertiser_id: account.externalId,
        campaign_ids: [id],
        operation_status: input.status === 'ACTIVE' ? 'ENABLE' : 'DISABLE',
      });
    if (input.name || input.dailyBudget !== undefined)
      await this.call(account, 'campaign/update/', {
        advertiser_id: account.externalId,
        campaign_id: id,
        ...(input.name ? { campaign_name: input.name } : {}),
        ...(input.dailyBudget !== undefined
          ? { budget: input.dailyBudget }
          : {}),
      });
    return { updated: true };
  }
}
