import {
  AdvertisingAccount,
  AdvertisingAdapter,
  CampaignInput,
  CampaignUpdate,
} from './advertising.interface';
import { readProviderJson } from '../engagement/engagement.interface';
export class MetaAdvertisingAdapter implements AdvertisingAdapter {
  private base() {
    return `https://graph.facebook.com/${
      process.env.GRAPH_API_VERSION || 'v27.0'
    }`;
  }
  private account(account: AdvertisingAccount) {
    return `act_${account.externalId.replace(/^act_/, '')}`;
  }
  private call(account: AdvertisingAccount, path: string, body?: unknown) {
    return readProviderJson(
      `${this.base()}/${path}`,
      { Authorization: `Bearer ${account.token}` },
      body
    );
  }
  async list(account: AdvertisingAccount) {
    const id = this.account(account);
    const [details, campaigns, performance] = await Promise.all([
      this.call(account, `${id}?fields=currency`),
      this.call(
        account,
        `${id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=100`
      ),
      this.call(
        account,
        `${id}/insights?level=campaign&date_preset=last_30d&fields=campaign_id,campaign_name,impressions,reach,clicks,spend&limit=100`
      ),
    ]);
    return {
      currency: details.currency,
      campaigns: campaigns.data || [],
      performance: performance.data || [],
    };
  }
  async create(account: AdvertisingAccount, input: CampaignInput) {
    const data = await this.call(
      account,
      `${this.account(account)}?fields=currency`
    );
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: data.currency,
    }).resolvedOptions().maximumFractionDigits;
    const objective = {
      TRAFFIC: 'OUTCOME_TRAFFIC',
      AWARENESS: 'OUTCOME_AWARENESS',
      ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
      LEADS: 'OUTCOME_LEADS',
      SALES: 'OUTCOME_SALES',
    }[input.objective];
    if (!objective) throw new Error('Unsupported campaign objective');
    return this.call(account, `${this.account(account)}/campaigns`, {
      name: input.name,
      objective,
      status: 'PAUSED',
      special_ad_categories: input.specialAdCategories || [],
      daily_budget: String(Math.round(input.dailyBudget * 10 ** digits)),
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    });
  }
  async update(account: AdvertisingAccount, id: string, input: CampaignUpdate) {
    let budget: string | undefined;
    if (input.dailyBudget !== undefined) {
      const details = await this.call(
        account,
        `${this.account(account)}?fields=currency`
      );
      const digits = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: details.currency,
      }).resolvedOptions().maximumFractionDigits;
      budget = String(Math.round(input.dailyBudget * 10 ** digits));
    }
    return this.call(account, encodeURIComponent(id), {
      ...(input.name ? { name: input.name } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(budget ? { daily_budget: budget } : {}),
    });
  }
}
