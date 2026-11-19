import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const sourceUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(sourceUrl.hostname) || sourceUrl.port !== '55322') throw new Error('Restore drills require the dedicated local Supabase stack');
const suffix = randomUUID().replaceAll('-', '');
const cloneName = `agency_restore_${suffix}`;
const dump = `/tmp/${cloneName}.dump`;
const container = 'supabase_db_agency-workspace';
const source = new PrismaClient();
let restored, created = false;
const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'agency-media');
const keys = [`restore-drill/${suffix}/source.txt`, `restore-drill/${suffix}/restored.txt`];
function run(args) {
  const result = spawnSync('docker', ['exec', container, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Backup command ${args[0]} failed: ${result.stderr}`);
}
async function counts(client) {
  const [brands, users, posts, reviews, reports, metrics, deliveries] = await Promise.all([client.organization.count(), client.user.count(), client.post.count(), client.brandReview.count(), client.brandReport.count(), client.brandMetric.count(), client.brandDeliveryAttempt.count()]);
  return { brands, users, posts, reviews, reports, metrics, deliveries };
}
try {
  const expected = await counts(source);
  run(['pg_dump', '-U', 'postgres', '--format=custom', '--schema=postiz', '--file', dump, 'postgres']);
  run(['createdb', '-U', 'postgres', cloneName]); created = true;
  run(['pg_restore', '-U', 'postgres', '--no-owner', '--exit-on-error', '--dbname', cloneName, dump]);
  const cloneUrl = new URL(sourceUrl); cloneUrl.pathname = `/${cloneName}`;
  restored = new PrismaClient({ datasources: { db: { url: cloneUrl.toString() } } });
  assert.deepEqual(await counts(restored), expected);
  console.log('PASS application schema backup restores into an isolated database with matching model counts');
  const bytes = Buffer.from(`Isolated storage restore fixture ${suffix}`);
  const uploaded = await storage.upload(keys[0], bytes, { contentType: 'text/plain', upsert: false }); if (uploaded.error) throw uploaded.error;
  const backup = await storage.download(keys[0]); if (backup.error) throw backup.error;
  const snapshot = Buffer.from(await backup.data.arrayBuffer());
  const restoredObject = await storage.upload(keys[1], snapshot, { contentType: 'text/plain', upsert: false }); if (restoredObject.error) throw restoredObject.error;
  const checked = await storage.download(keys[1]); if (checked.error) throw checked.error;
  assert.equal(createHash('sha256').update(Buffer.from(await checked.data.arrayBuffer())).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET || 'agency-media'}/${keys[1]}`;
  assert.notEqual((await fetch(publicUrl)).status, 200);
  console.log('PASS private object backup restores with the same SHA-256 and remains unavailable publicly');
  console.log('Local application/database and storage restore drill passed. Hosted Auth/PITR and Temporal disaster recovery require the staging release drill in the runbook.');
} finally {
  await restored?.$disconnect(); await source.$disconnect();
  await storage.remove(keys);
  if (created && /^agency_restore_[a-f0-9]{32}$/.test(cloneName)) run(['dropdb', '-U', 'postgres', cloneName]);
  run(['rm', '-f', dump]);
}
