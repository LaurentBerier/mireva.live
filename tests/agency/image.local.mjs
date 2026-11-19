import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'dotenv';

if (!['localhost', '127.0.0.1'].includes(new URL(process.env.SUPABASE_URL).hostname) || new URL(process.env.DATABASE_URL).port !== '55322') throw new Error('Image smoke tests require the dedicated local Supabase stack');
const name = `agency-image-qa-${randomUUID().replaceAll('-', '')}`;
const image = process.env.AGENCY_TEST_IMAGE || 'agency-workspace:local-20261119';
const sourceArchive = process.env.AGENCY_TEST_SOURCE_ARCHIVE || 'deploy/corresponding-source.tar.gz';
let launched = false;
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
try {
  const database = new URL(process.env.DATABASE_URL); database.hostname = 'host.docker.internal';
  // Compose parses quoted dotenv values; docker run --env-file treats quotes literally.
  const environment = Object.keys(parse(readFileSync('.env'))).flatMap(key => ['-e', key]);
  docker(['run', '-d', '--name', name, '--network', 'agency-workspace_default', '--memory', '1536m', '--cpus', '1.25', ...environment, '-p', '127.0.0.1:3300:3000',
    '-e', `DATABASE_URL=${database}`, '-e', `DIRECT_DATABASE_URL=${database}`, '-e', 'SUPABASE_URL=http://host.docker.internal:55321',
    '-e', 'REDIS_URL=redis://redis:6379', '-e', 'TEMPORAL_ADDRESS=temporal:7233', '-e', 'NODE_OPTIONS=--max-old-space-size=1024',
    '-e', 'RUN_CRON=false', '-e', 'RUN_AGENCY_SYNC=false', '-e', 'PUBLISHING_ENABLED=false', '-e', 'ENGAGEMENT_ENABLED=false', '-e', 'ADS_WRITES_ENABLED=false', image,
    // Cloud TLS credentials cannot target this deliberately local fixture.
    ...(process.env.AGENCY_TEST_VERCEL_IMAGE === 'true' ? ['node', 'scripts/agency-run-service.cjs', 'backend'] : [])]); launched = true;
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (docker(['inspect', '--format', '{{.State.Running}}', name]) !== 'true') throw new Error('The image stopped during startup');
    try { ready = (await fetch('http://127.0.0.1:3300/agency-public/health', { signal: AbortSignal.timeout(2000) })).ok; if (ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, 'The API must become ready under the configured CPU/memory limits');
  const owner = JSON.parse(readFileSync('.secrets/agency-local-owner.json', 'utf8'));
  const auth = createClient(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await auth.auth.signInWithPassword(owner); if (session.error) throw session.error;
  const context = await fetch('http://127.0.0.1:3300/agency/context', { headers: { Authorization: `Bearer ${session.data.session.access_token}` } });
  assert.equal(context.status, 200); assert((await context.json()).brands.length > 0);
  const source = await fetch('http://127.0.0.1:3300/agency-public/source'); assert.equal(source.status, 200);
  assert.equal(createHash('sha256').update(Buffer.from(await source.arrayBuffer())).digest('hex'), createHash('sha256').update(readFileSync(sourceArchive)).digest('hex'));
  console.log('PASS Linux Node 22 image starts within 1.25 CPU / 1536 MiB limits, verifies a Supabase identity, and serves its matching source archive');
  console.log('Observed idle usage: ' + docker(['stats', '--no-stream', '--format', '{{.MemUsage}}; CPU {{.CPUPerc}}', name]));
  console.log('This is a startup smoke test, not a ten-brand load/capacity certification.');
} catch (error) {
  if (launched) {
    const logs = spawnSync('docker', ['logs', '--tail', '60', name], { encoding: 'utf8' });
    let clean = logs.stdout + logs.stderr;
    for (const [key, value] of Object.entries(process.env)) if (/SECRET|KEY|PASSWORD|TOKEN/.test(key) && value?.length >= 8) clean = clean.replaceAll(value, '[redacted]');
    console.error(clean.replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:[redacted]@'));
  }
  throw error;
} finally {
  if (launched && /^agency-image-qa-[a-f0-9]{32}$/.test(name)) docker(['rm', '-f', name]);
}
