import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { Connection, Client } from '@temporalio/client';

if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL).hostname) || new URL(process.env.DATABASE_URL).port !== '55322') throw new Error('HTTP tests require the dedicated local Supabase stack');
if (process.env.PUBLISHING_ENABLED === 'true' || process.env.ENGAGEMENT_ENABLED === 'true' || process.env.ADS_WRITES_ENABLED === 'true') throw new Error('Disable all live write flags before these tests');
const db = new PrismaClient();
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const backend = 'http://localhost:3000';
const frontend = 'http://localhost:4200';
const createdAuth = [], createdUsers = [], createdOrgs = [], storageKeys = [];
let agency;
let temporalConnection;
const workflowIds = [];
function passed(name) { console.log(`PASS ${name}`); }
async function account(role, org) {
  const email = `${randomUUID()}@agency.test`, password = randomUUID() + '!Qa';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error; createdAuth.push(data.user.id);
  const user = await db.user.create({ data: { email, supabaseId: data.user.id, providerName: 'GENERIC', timezone: 0 } }); createdUsers.push(user.id);
  await db.userOrganization.create({ data: { userId: user.id, organizationId: org.id, role } });
  const session = await anon().auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { user, token: session.data.session.access_token, email, password };
}
async function api(auth, org, path, method = 'GET', body) {
  return fetch(backend + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}), ...(org ? { showorg: org.id } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual' });
}
try {
  agency = await db.agencyWorkspace.create({ data: { name: `HTTP QA ${randomUUID()}` } });
  const first = await db.organization.create({ data: { name: 'HTTP QA first brand', agencyId: agency.id, approvalRequired: true, apiKey: randomUUID() } }); createdOrgs.push(first.id);
  const other = await db.organization.create({ data: { name: 'HTTP QA isolated brand', agencyId: agency.id, approvalRequired: true } }); createdOrgs.push(other.id);
  const owner = await account('SUPERADMIN', first), staff = await account('ADMIN', first), client = await account('REVIEWER', first), outsider = await account('USER', other);
  await db.agencyWorkspaceMember.createMany({ data: [{ agencyId: agency.id, userId: owner.user.id, role: 'SUPERADMIN' }, { agencyId: agency.id, userId: staff.user.id, role: 'USER' }] });
  const signup = await anon().auth.signUp({ email: `${randomUUID()}@agency.test`, password: randomUUID() }); assert.equal(signup.error?.code, 'signup_disabled'); passed('public signup is disabled while invited email login works');
  const exposed = await fetch(`${process.env.SUPABASE_URL}/rest/v1/Organization?select=id`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Accept-Profile': 'postiz' } });
  assert.equal(exposed.status, 406); assert.equal((await exposed.json()).code, 'PGRST106'); passed('application schema is excluded from the Supabase Data API');
  await admin.auth.admin.updateUserById(client.user.supabaseId, { user_metadata: { role: 'SUPERADMIN', isSuperAdmin: true, organizationId: other.id } });
  assert.equal((await api(staff, first, '/agency/context')).status, 200);
  assert.equal((await api(client, other, '/agency/context')).status, 401);
  assert.equal((await api(client, first, '/settings/team')).status, 401);
  assert.equal((await api(client, first, '/agency/members')).status, 403);
  const policyChange = await api(staff, first, '/agency/brand', 'PATCH', { approvalRequired: false });
  assert.equal(policyChange.status, 403, JSON.stringify({ response: await policyChange.json(), context: await (await api(staff, first, '/agency/context')).json(), stored: await db.organization.findUnique({ where: { id: first.id }, select: { approvalRequired: true } }) }));
  assert.equal((await api(owner, first, '/agency/brand', 'PATCH', { users: { deleteMany: {} } })).status, 400);
  const self = await (await api(client, first, '/user/self')).json(); assert.equal(self.publicApi, ''); assert.equal(self.role, 'REVIEWER'); passed('staff/client brand isolation, policy permissions, and DTO write restrictions');
  await api(owner, first, '/agency/brand', 'PATCH', { timezoneName: 'Europe/Paris' });
  assert.equal((await (await api(client, first, '/user/self')).json()).brandTimezoneName, 'Europe/Paris');
  await api(owner, first, '/agency/brand', 'PATCH', { timezoneName: 'America/Toronto' });
  const invalidOrigin = await fetch(`${frontend}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://foreign.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: client.email, password: client.password }) }); assert.equal(invalidOrigin.status, 403);
  const login = await fetch(`${frontend}/api/auth/login`, { method: 'POST', headers: { Origin: frontend, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: client.email, password: client.password, returnTo: '//foreign.example.test' }) }); assert.equal(login.status, 200, await login.clone().text()); assert.equal((await login.json()).next, '/agency');
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert(login.headers.getSetCookie().some(value => value.startsWith('auth=') && /HttpOnly/i.test(value)));
  const proxyIdentity = await fetch(`${frontend}/api/backend/user/self`, { headers: { Cookie: cookie } }); assert.equal(proxyIdentity.status, 200); assert.equal((await proxyIdentity.json()).role, 'REVIEWER');
  assert.equal((await fetch(`${frontend}/api/auth/session`, { headers: { Cookie: cookie } })).status, 200);
  passed('production frontend login, HttpOnly session bridge, same-origin protection and safe return URL');
  const fixtureMetrics = Array.from({ length: 40 }, (_, index) => ({ key: randomUUID(), organizationId: first.id, integrationId: 'local-fixture', provider: 'Synthetic QA provider', subjectId: '', metric: index === 0 ? '=LOCAL_FORMULA_FIXTURE' : `Synthetic metric ${String(index + 1).padStart(2, '0')}`, value: index + 1, definition: 'Synthetic local QA measurement for export pagination; never provider data.', periodStart: new Date('2026-11-18T00:00:00Z') }));
  await db.brandMetric.createMany({ data: fixtureMetrics });
  const reportIds = [];
  mkdirSync('reports/agency-qa', { recursive: true });
  for (const format of ['pdf', 'pptx', 'csv']) {
    const created = await api(owner, first, '/agency/reports', 'POST', { name: 'Local export validation', from: '2026-11-01T00:00:00Z', to: '2026-11-19T23:59:59Z', format, accentColor: '612BD3' }); assert.equal(created.status, 201);
    const report = await created.json(); reportIds.push(report.id);
    const download = await api(client, first, `/agency/reports/${report.id}/download`); assert.equal(download.status, 200);
    writeFileSync(`reports/agency-qa/report.${format}`, Buffer.from(await download.arrayBuffer()));
    if (format === 'csv') assert.match(Buffer.from(await (await api(client, first, `/agency/reports/${report.id}/download`)).arrayBuffer()).toString(), /'=LOCAL_FORMULA_FIXTURE/);
    assert.equal((await api(outsider, other, `/agency/reports/${report.id}/download`)).status, 404);
  }
  const share = await (await api(owner, first, `/agency/reports/${reportIds[0]}/share`, 'POST', {})).json();
  const shareToken = share.url.split('/').pop(); assert.equal((await fetch(`${backend}/agency-public/reports/${shareToken}`)).status, 200);
  await api(owner, first, `/agency/reports/${reportIds[0]}/share`, 'DELETE');
  assert.equal((await fetch(`${backend}/agency-public/reports/${shareToken}`)).status, 404); passed('report exports, tenant isolation, and revocable sharing');
  await db.brandMetric.createMany({ data: [first, other].map((org, index) => ({ key: randomUUID(), organizationId: org.id, integrationId: randomUUID(), provider: 'qa_fixture', subjectId: '', metric: 'Synthetic fixture', value: index + 1, definition: 'Synthetic local QA record', periodStart: new Date() })) });
  const key = await (await api(owner, first, '/agency/insights/keys', 'POST', {})).json();
  const connector = await fetch(`${backend}/agency-public/metrics`, { headers: { Authorization: `Bearer ${key.token}` } }); assert.equal(connector.status, 200);
  const measurements = await connector.json(); assert.equal(measurements.rows.length, 41); assert(measurements.rows.every(row => row.organizationId === undefined || row.organizationId === first.id));
  assert.equal((await api(client, first, '/agency/insights/keys', 'POST', {})).status, 403);
  await api(owner, first, `/agency/insights/keys/${key.id}`, 'DELETE');
  assert.equal((await fetch(`${backend}/agency-public/metrics`, { headers: { Authorization: `Bearer ${key.token}` } })).status, 401); passed('read-only Looker key scopes and revocation');
  const bytes = await sharp({ create: { width: 240, height: 72, channels: 3, background: '#612BD3' } }).png().toBuffer();
  const initialized = await api(owner, first, '/media/supabase/initialize', 'POST', { name: 'qa-pixel.png', contentType: 'image/png', size: bytes.length }); assert.equal(initialized.status, 201);
  const ticket = await initialized.json(); storageKeys.push(ticket.objectKey);
  const headers = { 'Tus-Resumable': '1.0.0', 'x-signature': ticket.token, 'x-upsert': 'false', apikey: ticket.apiKey };
  const metadata = Object.entries({ bucketName: ticket.bucket, objectName: ticket.objectKey, contentType: 'image/png', cacheControl: '3600' }).map(([key, value]) => `${key} ${Buffer.from(value).toString('base64')}`).join(',');
  const started = await fetch(ticket.endpoint, { method: 'POST', headers: { ...headers, 'Upload-Length': String(bytes.length), 'Upload-Metadata': metadata } }); assert.equal(started.status, 201, await started.text());
  const location = new URL(started.headers.get('Location'), ticket.endpoint);
  const probe = await fetch(location, { method: 'HEAD', headers }); assert.equal(probe.headers.get('upload-offset'), '0');
  const chunk = await fetch(location, { method: 'PATCH', headers: { ...headers, 'Upload-Offset': '0', 'Content-Type': 'application/offset+octet-stream' }, body: bytes }); assert.equal(chunk.status, 204, await chunk.text());
  const [complete, simultaneous] = await Promise.all([api(owner, first, `/media/supabase/${ticket.ticketId}/complete`, 'POST', {}), api(owner, first, `/media/supabase/${ticket.ticketId}/complete`, 'POST', {})]);
  assert.equal(complete.status, 201, await complete.clone().text()); assert.equal(simultaneous.status, 201, await simultaneous.clone().text());
  const saved = await complete.json(); storageKeys.push(saved.name);
  assert.equal((await simultaneous.json()).id, saved.id);
  const path = new URL(saved.path).pathname.replace(/^\/api\/backend/, '');
  assert(saved.name.startsWith('sealed/')); assert.notEqual(saved.name, ticket.objectKey);
  assert.equal((await api(client, first, `/media/private/${encodeURIComponent(ticket.objectKey)}`)).status, 404);
  assert.equal((await api(client, first, path)).status, 302);
  assert.equal((await api(outsider, other, path)).status, 404);
  assert.equal((await api(null, null, path)).status, 401);
  const signed = await api(client, first, path); assert.equal((await fetch(signed.headers.get('Location'))).status, 200);
  assert.equal((await api(owner, first, `/media/supabase/${ticket.ticketId}/complete`, 'POST', {})).status, 201); passed('real private TUS upload, S3 validation, signed access, and idempotent completion');
  for (const format of ['pdf', 'pptx']) {
    const created = await api(owner, first, '/agency/reports', 'POST', { name: 'Branded local export validation', from: '2026-11-01T00:00:00Z', to: '2026-11-19T23:59:59Z', format, accentColor: '612BD3', logoMediaId: saved.id });
    assert.equal(created.status, 201); const report = await created.json();
    const download = await api(client, first, `/agency/reports/${report.id}/download`); assert.equal(download.status, 200, await download.clone().text());
    writeFileSync(`reports/agency-qa/branded.${format}`, Buffer.from(await download.arrayBuffer()));
  }
  passed('branded multi-page PDF/PowerPoint exports with a private logo');
  const integration = await db.integration.create({ data: { organizationId: first.id, internalId: randomUUID(), name: 'Synthetic unavailable connection', providerIdentifier: 'bluesky', token: 'not-a-live-token', type: 'social' } });
  const post = await db.post.create({ data: { organizationId: first.id, integrationId: integration.id, group: randomUUID(), content: 'Synthetic QA draft', publishDate: new Date(Date.now() + 86400000), state: 'DRAFT', image: JSON.stringify([{ id: saved.id, path: saved.path }]) } });
  const publicSchedule = await fetch(`${backend}/public/v1/posts/${post.id}/status`, { method: 'PUT', headers: { Authorization: first.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'schedule' }) });
  assert.equal(publicSchedule.status, 403, await publicSchedule.text());
  const csv = `channel_id,publish_at,content,media_ids,settings_json,repeat_days\r\n${integration.id},${new Date(Date.now() + 86400000).toISOString()},"Quoted, multiline\nimport fixture",${saved.id},,2`;
  const preview = await api(staff, first, '/agency/imports/preview', 'POST', { csv }); assert.equal(preview.status, 201); assert.deepEqual((await preview.json())[0].errors, []);
  const requestId = randomUUID(); const imported = await api(staff, first, '/agency/imports', 'POST', { requestId, csv }); assert.equal(imported.status, 201, await imported.clone().text());
  const importedRows = await imported.json(); assert.equal(importedRows.length, 1);
  const importedPost = await db.post.findUniqueOrThrow({ where: { id: importedRows[0].postId } }); assert.equal(importedPost.state, 'DRAFT'); assert.equal(importedPost.intervalInDays, 2); assert.match(importedPost.content, /Quoted, multiline/);
  assert.deepEqual(await (await api(staff, first, '/agency/imports', 'POST', { requestId, csv })).json(), importedRows);
  assert.equal((await api(staff, first, '/agency/imports', 'POST', { requestId, csv: csv.replace('fixture', 'changed') })).status, 409);
  assert.equal((await api(client, first, '/agency/imports/preview', 'POST', { csv })).status, 403);
  const foreignPreview = await (await api(outsider, other, '/agency/imports/preview', 'POST', { csv })).json(); assert(foreignPreview[0].errors.length >= 2);
  passed('quoted CSV preview, tenant checks, draft-only imports, and idempotent retry');
  const request = await api(staff, first, '/agency/reviews', 'POST', { group: post.group }); assert.equal(request.status, 201); const review = await request.json();
  assert.equal((await api(staff, first, `/agency/reviews/${review.id}/decision`, 'POST', { state: 'APPROVED' })).status, 403);
  assert.equal((await api(client, first, `/agency/reviews/${review.id}/decision`, 'POST', { state: 'APPROVED' })).status, 201);
  const scheduled = await api(staff, first, `/agency/reviews/${review.id}/schedule`, 'POST', {}); assert.equal(scheduled.status, 201, await scheduled.clone().text());
  temporalConnection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS });
  const temporal = new Client({ connection: temporalConnection, namespace: process.env.TEMPORAL_NAMESPACE });
  const workflowId = `post_${post.id}`; workflowIds.push(workflowId);
  assert.equal((await temporal.workflow.getHandle(workflowId).describe()).status.name, 'RUNNING');
  let queuedFingerprint;
  for (let attempt = 0; attempt < 30; attempt++) {
    const history = await temporal.workflow.getHandle(workflowId).fetchHistory();
    const payload = history.events.find(event => event.activityTaskCompletedEventAttributes?.result?.payloads?.[0])?.activityTaskCompletedEventAttributes.result.payloads[0];
    if (payload?.data) { queuedFingerprint = JSON.parse(Buffer.from(payload.data).toString()).reviewFingerprint; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.match(queuedFingerprint || '', /^[a-f0-9]{64}$/, 'The worker must bind the queued workflow to the reviewed fingerprint');
  const cancelled = await fetch(`${backend}/public/v1/posts/${post.id}/status`, { method: 'PUT', headers: { Authorization: first.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'draft' }) }); assert.equal(cancelled.status, 200);
  assert.equal((await temporal.workflow.getHandle(workflowId).describe()).status.name, 'TERMINATED');
  passed('approved scheduling creates a durable Temporal workflow and cancellation terminates it');
  await db.post.update({ where: { id: post.id }, data: { content: 'Changed after review', approvalVersion: { increment: 1 } } });
  assert.equal((await api(staff, first, `/agency/reviews/${review.id}/schedule`, 'POST', {})).status, 403); passed('reviewer-only decisions and stale approval scheduling rejection');
  const member = await db.userOrganization.findUniqueOrThrow({ where: { userId_organizationId: { userId: client.user.id, organizationId: first.id } } });
  await api(owner, first, `/agency/members/${member.id}`, 'PATCH', { disabled: true });
  assert.equal((await api(client, first, '/agency/context')).status, 401); passed('revoked membership invalidates an existing Supabase session');
  const staffMembership = await db.userOrganization.findUniqueOrThrow({ where: { userId_organizationId: { userId: staff.user.id, organizationId: first.id } } });
  await api(owner, first, `/agency/members/${staffMembership.id}`, 'PATCH', { disabled: true });
  assert.equal((await fetch(`${backend}/public/v1/integrations`, { headers: { Authorization: first.apiKey } })).status, 401);
  passed('revoking a brand administrator rotates the legacy shared API key');
  console.log('All local HTTP smoke tests passed. No live social calls were made.');
} finally {
  if (temporalConnection) {
    const temporal = new Client({ connection: temporalConnection, namespace: process.env.TEMPORAL_NAMESPACE });
    for (const id of workflowIds) await temporal.workflow.getHandle(id).terminate('Isolated HTTP QA cleanup').catch(() => {});
    await temporalConnection.close();
  }
  for (const key of storageKeys) await admin.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'agency-media').remove([key]);
  const where = { organizationId: { in: createdOrgs } };
  await db.brandReview.deleteMany({ where }); await db.post.deleteMany({ where }); await db.integration.deleteMany({ where }); await db.media.deleteMany({ where });
  await db.brandUploadTicket.deleteMany({ where }); await db.brandReport.deleteMany({ where }); await db.brandAnalyticsKey.deleteMany({ where }); await db.brandMetric.deleteMany({ where }); await db.brandImport.deleteMany({ where }); await db.brandSyncRun.deleteMany({ where });
  await db.userOrganization.deleteMany({ where }); await db.agencyWorkspaceMember.deleteMany({ where: { agencyId: agency?.id || '' } });
  await db.organization.deleteMany({ where: { id: { in: createdOrgs } } }); if (agency) await db.agencyWorkspace.delete({ where: { id: agency.id } });
  await db.user.deleteMany({ where: { id: { in: createdUsers } } });
  for (const id of createdAuth) await admin.auth.admin.deleteUser(id);
  await db.$disconnect();
}
