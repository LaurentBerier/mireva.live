export type AdvertisingAccount = {
  externalId: string;
  token: string;
  loginAccountId?: string | null;
};
export type CampaignInput = {
  name: string;
  dailyBudget: number;
  objective: string;
  politicalDeclaration?: string;
  specialAdCategories?: string[];
};
export type CampaignUpdate = {
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  dailyBudget?: number;
};
export interface AdvertisingAdapter {
  list(
    account: AdvertisingAccount
  ): Promise<{ currency?: string; campaigns: any[]; performance: any[] }>;
  create(
    account: AdvertisingAccount,
    input: CampaignInput
  ): Promise<{ id: string }>;
  update(
    account: AdvertisingAccount,
    id: string,
    input: CampaignUpdate
  ): Promise<unknown>;
}
