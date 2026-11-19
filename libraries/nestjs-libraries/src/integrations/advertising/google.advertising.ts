import {
  AdvertisingAccount,
  AdvertisingAdapter,
  CampaignInput,
  CampaignUpdate,
} from './advertising.interface';
import { readProviderJson } from '../engagement/engagement.interface';
export class GoogleAdvertisingAdapter implements AdvertisingAdapter {
  private call(account: AdvertisingAccount, path: string, body: unknown) {
    const id = account.externalId.replace(/-/g, '');
    return readProviderJson(
      `https://googleads.googleapis.com/${
        process.env.GOOGLE_ADS_API_VERSION || 'v26'
      }/customers/${id}/${path}`,
      {
        Authorization: `Bearer ${account.token}`,
        ...(account.loginAccountId
          ? { 'login-customer-id': account.loginAccountId.replace(/-/g, '') }
          : {}),
      },
      body
    );
  }
  async list(account: AdvertisingAccount) {
    const campaigns = await this.call(account, 'googleAds:search', {
      query:
        "SELECT campaign.id, campaign.name, campaign.status, campaign.campaign_budget FROM campaign WHERE campaign.status != 'REMOVED'",
    });
    const performance = await this.call(account, 'googleAds:search', {
      query:
        'SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS',
    });
    const customer = await this.call(account, 'googleAds:search', {
      query: 'SELECT customer.currency_code FROM customer LIMIT 1',
    });
    return {
      currency: customer.results?.[0]?.customer?.currencyCode,
      campaigns: (campaigns.results || []).map((row: any) => ({
        id: row.campaign.id,
        name: row.campaign.name,
        status: row.campaign.status,
        budgetResource: row.campaign.campaignBudget,
      })),
      performance: performance.results || [],
    };
  }
  async create(account: AdvertisingAccount, input: CampaignInput) {
    if (!input.politicalDeclaration)
      throw new Error(
        'The Google campaign requires its EU political advertising declaration'
      );
    if (input.objective !== 'TRAFFIC')
      throw new Error(
        'This creation form supports Search traffic campaigns; manage other campaign types in the native platform'
      );
    const budget = await this.call(account, 'campaignBudgets:mutate', {
      operations: [
        {
          create: {
            name: `${input.name} budget`,
            amountMicros: String(Math.round(input.dailyBudget * 1e6)),
            deliveryMethod: 'STANDARD',
            explicitlyShared: false,
          },
        },
      ],
    });
    const result = await this.call(account, 'campaigns:mutate', {
      operations: [
        {
          create: {
            name: input.name,
            advertisingChannelType: 'SEARCH',
            status: 'PAUSED',
            campaignBudget: budget.results[0].resourceName,
            targetSpend: {},
            containsEuPoliticalAdvertising: input.politicalDeclaration,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: false,
              targetContentNetwork: false,
            },
          },
        },
      ],
    });
    return { id: result.results[0].resourceName.split('/').pop() };
  }
  async update(account: AdvertisingAccount, id: string, input: CampaignUpdate) {
    if (input.dailyBudget !== undefined) {
      const campaigns = await this.list(account);
      const campaign = campaigns.campaigns.find(
        (campaign) => campaign.id === id
      );
      if (!campaign?.budgetResource)
        throw new Error('Campaign budget unavailable');
      await this.call(account, 'campaignBudgets:mutate', {
        operations: [
          {
            update: {
              resourceName: campaign.budgetResource,
              amountMicros: String(Math.round(input.dailyBudget * 1e6)),
            },
            updateMask: 'amount_micros',
          },
        ],
      });
    }
    const fields = [
      input.name ? 'name' : '',
      input.status ? 'status' : '',
    ].filter(Boolean);
    if (!fields.length) return { updated: true };
    return this.call(account, 'campaigns:mutate', {
      operations: [
        {
          update: {
            resourceName: `customers/${account.externalId.replace(
              /-/g,
              ''
            )}/campaigns/${id}`,
            ...(input.name ? { name: input.name } : {}),
            ...(input.status
              ? { status: input.status === 'ACTIVE' ? 'ENABLED' : 'PAUSED' }
              : {}),
          },
          updateMask: fields.join(','),
        },
      ],
    });
  }
}
