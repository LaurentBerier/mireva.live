import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Connection, Client } from '@temporalio/client';

if (!['127.0.0.1:57233', 'localhost:57233'].includes(process.env.TEMPORAL_ADDRESS)) throw new Error('Temporal restore drills require the dedicated local stack');
const suffix = randomUUID().replaceAll('-', '');
const databaseContainer = 'agency-workspace-temporal-db-1';
const restoredContainer = `agency-temporal-restore-${suffix}`;
const restoredDbContainer = `agency-temporal-restore-db-${suffix}`;
const sources = ['temporal', 'temporal_visibility'];
const namespace = process.env.TEMPORAL_NAMESPACE;
const workflowId = `restore-drill-${suffix}`;
let originalConnection, restoredConnection, original, launched = false, databaseLaunched = false;
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
async function visible(client) {
  for await (const item of client.workflow.list({ query: `WorkflowId="${workflowId}"` })) if (item.workflowId === workflowId) return true;
  return false;
}
try {
  originalConnection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS });
  original = new Client({ connection: originalConnection, namespace });
  // No workers listen on this fixture queue; it cannot run provider activities.
  await original.workflow.start('agencyMaintenanceV1', { workflowId, taskQueue: `restore-paused-${suffix}` });
  for (let attempt = 0; attempt < 30 && !await visible(original); attempt++) await new Promise(resolve => setTimeout(resolve, 500));
  assert(await visible(original), 'The source visibility index must contain the fixture before backup');
  const snapshots = sources.map(source => {
    const result = spawnSync('docker', ['exec', databaseContainer, 'pg_dump', '-U', 'temporal', '--format=custom', source], { maxBuffer: 100 * 1024 * 1024 });
    if (result.status !== 0) throw new Error('Temporal database backup failed');
    return result.stdout;
  });
  docker(['run', '-d', '--name', restoredDbContainer, '--network', 'agency-workspace_default', '--memory', '768m', '-e', 'POSTGRES_USER=temporal', '-e', 'POSTGRES_PASSWORD=isolated-restore-fixture', '-e', 'POSTGRES_DB=temporal', 'postgres:16-alpine']); databaseLaunched = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (spawnSync('docker', ['exec', restoredDbContainer, 'pg_isready', '-U', 'temporal']).status === 0) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  docker(['exec', restoredDbContainer, 'createdb', '-U', 'temporal', 'temporal_visibility']);
  for (let index = 0; index < sources.length; index++) {
    const restored = spawnSync('docker', ['exec', '-i', restoredDbContainer, 'pg_restore', '-U', 'temporal', '--no-owner', '--exit-on-error', '--dbname', sources[index]], { input: snapshots[index], encoding: 'utf8' });
    if (restored.status !== 0) throw new Error(`Temporal restore failed: ${restored.stderr}`);
  }
  docker(['run', '-d', '--name', restoredContainer, '--network', 'agency-workspace_default', '--memory', '1536m', '-p', '127.0.0.1:57234:7233',
    '-e', 'DB=postgres12', '-e', 'DB_PORT=5432', '-e', 'POSTGRES_USER=temporal', '-e', 'POSTGRES_PWD=isolated-restore-fixture',
    '-e', `POSTGRES_SEEDS=${restoredDbContainer}`, '-e', 'DBNAME=temporal', '-e', 'VISIBILITY_DBNAME=temporal_visibility',
    '-e', 'SKIP_SCHEMA_SETUP=true', '-e', 'SKIP_DB_CREATE=true', '-e', 'SKIP_DEFAULT_NAMESPACE_CREATION=true', '-e', 'SKIP_ADD_CUSTOM_SEARCH_ATTRIBUTES=true',
    'temporalio/auto-setup:1.28.1']); launched = true;
  const address = '127.0.0.1:57234';
  for (let attempt = 0; attempt < 20; attempt++) {
    if (docker(['inspect', '--format', '{{.State.Running}}', restoredContainer]) !== 'true') throw new Error('The restored Temporal server stopped during startup');
    try { restoredConnection = await Connection.connect({ address }); break; }
    catch (error) { if (attempt === 19) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  const restored = new Client({ connection: restoredConnection, namespace });
  const described = await restored.workflow.getHandle(workflowId).describe();
  assert.equal(described.status.name, 'RUNNING'); assert(await visible(restored));
  const history = await restored.workflow.getHandle(workflowId).fetchHistory(); assert(history.events.length > 0);
  console.log('PASS restored Temporal persistence and visibility databases preserve namespace, queued workflow, history, and search results');
  console.log('The restored server had no workers and made no provider calls. Hosted disaster recovery and target-host rollback remain staging release gates.');
} catch (error) {
  if (launched) {
    const logs = spawnSync('docker', ['logs', '--tail', '25', restoredContainer], { encoding: 'utf8' });
    console.error((logs.stdout + logs.stderr).replaceAll(process.env.TEMPORAL_DB_PASSWORD || 'local-temporal-password', '[redacted]'));
  }
  throw error;
} finally {
  await restoredConnection?.close();
  if (launched && /^agency-temporal-restore-[a-f0-9]{32}$/.test(restoredContainer)) docker(['rm', '-f', restoredContainer]);
  if (databaseLaunched && /^agency-temporal-restore-db-[a-f0-9]{32}$/.test(restoredDbContainer)) docker(['rm', '-fv', restoredDbContainer]);
  await original?.workflow.getHandle(workflowId).terminate('Isolated restore drill cleanup').catch(() => {});
  await originalConnection?.close();
}
