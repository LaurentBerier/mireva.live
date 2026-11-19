import { readFileSync } from 'fs';
import { join } from 'path';
import inventory from '../../docs/agency/feature-inventory.json';
import { MetaAdvertisingAdapter } from '../../libraries/nestjs-libraries/src/integrations/advertising/meta.advertising';
import { GoogleAdvertisingAdapter } from '../../libraries/nestjs-libraries/src/integrations/advertising/google.advertising';
import { TiktokAdvertisingAdapter } from '../../libraries/nestjs-libraries/src/integrations/advertising/tiktok.advertising';
import { MetaEngagementAdapter } from '../../libraries/nestjs-libraries/src/integrations/engagement/meta.engagement';
import { YoutubeEngagementAdapter } from '../../libraries/nestjs-libraries/src/integrations/engagement/youtube.engagement';
import { TiktokBusinessEngagementAdapter } from '../../libraries/nestjs-libraries/src/integrations/engagement/tiktok.engagement';
import { InboxReadContext } from '../../libraries/nestjs-libraries/src/integrations/engagement/engagement.interface';
import { DribbbleProvider } from '../../libraries/nestjs-libraries/src/integrations/social/dribbble.provider';

const realFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
afterAll(() => { global.fetch = realFetch; });
function response(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
test('Dribbble renewal requests reconnection and never contacts another provider', async () => {
  await expect(new DribbbleProvider().refreshToken('fixture')).rejects.toThrow('Reconnect Dribbble');
  expect(fetchMock).not.toHaveBeenCalled();
});
const account = { externalId: '123-456', token: 'fixture-token', loginAccountId: '999-111' };
const context = { integration: { internalId: 'page-1', token: 'fixture-token' }, publishedIds: ['video-1'] } as InboxReadContext;

test.each(inventory.providers.filter(provider => provider.registered).map(provider => [provider.id, provider]))('%s remains represented in the inventory and upstream registry', (_id, provider: any) => {
  const manager = readFileSync('libraries/nestjs-libraries/src/integrations/integration.manager.ts', 'utf8');
  const imports = [...manager.matchAll(/import \{ (\w+) \} from '@gitroom\/nestjs-libraries\/integrations\/social\/([^']+)';/g)];
  const sources = imports.filter(([, name]) => new RegExp(`^  new ${name}\\(`, 'm').test(manager)).map(([, , path]) => readFileSync(join('libraries/nestjs-libraries/src/integrations/social', path + '.ts'), 'utf8'));
  expect(sources.some(source => new RegExp(`identifier\\s*=\\s*['"]${provider.id}['"]`).test(source))).toBe(true);
  expect(provider.credentialStatus).not.toBe('verified');
  expect(provider.liveVerificationStatus).not.toBe('verified');
});
test('Meta campaign creation preserves minor currency units and starts paused', async () => {
  fetchMock.mockResolvedValueOnce(response({ currency: 'JPY' })).mockResolvedValueOnce(response({ id: 'campaign-1' }));
  await new MetaAdvertisingAdapter().create(account as any, { name: 'Fixture', objective: 'TRAFFIC', dailyBudget: 1000 });
  const body = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body).toMatchObject({ status: 'PAUSED', objective: 'OUTCOME_TRAFFIC', daily_budget: '1000' });
  expect(fetchMock.mock.calls[1][0]).toMatch(/act_123-456\/campaigns$/);
});
test('Google uses current Cloud API access and a paused campaign with political declaration', async () => {
  fetchMock.mockResolvedValueOnce(response({ results: [{ resourceName: 'customers/123456/campaignBudgets/1' }] })).mockResolvedValueOnce(response({ results: [{ resourceName: 'customers/123456/campaigns/2' }] }));
  await new GoogleAdvertisingAdapter().create(account as any, { name: 'Fixture', objective: 'TRAFFIC', dailyBudget: 2.5, politicalDeclaration: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' });
  expect(fetchMock.mock.calls[0][0]).toContain('/v26/customers/123456/');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer fixture-token', 'login-customer-id': '999111' });
  expect(fetchMock.mock.calls[0][1].headers['developer-token']).toBeUndefined();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).operations[0].create).toMatchObject({ status: 'PAUSED', containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' });
});
test('TikTok creates a disabled manual traffic campaign', async () => {
  fetchMock.mockResolvedValue(response({ code: 0, data: { campaign_id: 'campaign-2' } }));
  await new TiktokAdvertisingAdapter().create(account as any, { name: 'Fixture', objective: 'TRAFFIC', dailyBudget: 30 });
  expect(fetchMock.mock.calls[0][1].headers['Access-Token']).toBe('fixture-token');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ advertiser_id: account.externalId, operation_status: 'DISABLE', objective_type: 'TRAFFIC' });
});
test('Meta polling and webhooks use the counterparty to deduplicate DM conversations', async () => {
  fetchMock.mockImplementation(async (url: string) => response(url.includes('conversations') ? { data: [{ id: 'opaque-conversation-id', participants: { data: [{ id: 'page-1' }, { id: 'visitor-1' }] }, messages: { data: [{ id: 'message-1', from: { id: 'visitor-1' }, message: 'Hello', created_time: '2026-11-19T10:00:00Z' }] } }] } : { data: [] }));
  const result = await new MetaEngagementAdapter().read(context);
  expect(result.threads[0]).toMatchObject({ id: 'DM:visitor-1', kind: 'DM' });
});
test('Meta private replies target the comment through the messaging endpoint', async () => {
  fetchMock.mockResolvedValue(response({ message_id: 'reply-1' }));
  await new MetaEngagementAdapter().privateReply(context, 'comment-1', 'Details');
  expect(fetchMock.mock.calls[0][0]).toMatch(/page-1\/messages$/);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ recipient: { comment_id: 'comment-1' }, message: { text: 'Details' } });
});
test('YouTube replies use the top-level comment parent and OAuth header', async () => {
  fetchMock.mockResolvedValue(response({ id: 'reply-1' }));
  await new YoutubeEngagementAdapter().reply(context, { externalId: 'COMMENT:comment-1' }, null, 'Thanks');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ snippet: { parentId: 'comment-1', textOriginal: 'Thanks' } });
});
test('TikTok Business replies use the creator business ID and native video/comment IDs', async () => {
  fetchMock.mockResolvedValue(response({ code: 0, data: { comment_id: 'reply-1' } }));
  await new TiktokBusinessEngagementAdapter().reply(context, { externalId: 'COMMENT:video-1:comment-1' }, { externalId: 'comment-1' }, 'Thanks');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ business_id: 'page-1', video_id: 'video-1', comment_id: 'comment-1', text: 'Thanks' });
});
