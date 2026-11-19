import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
const current = existsSync('.env') ? dotenv.parse(readFileSync('.env')) : {};
if (current.SUPABASE_URL && !['localhost', '127.0.0.1'].includes(new URL(current.SUPABASE_URL).hostname)) throw new Error('This helper only updates local Supabase settings');
const manager = process.env.npm_execpath;
if (!manager) throw new Error('Run through pnpm agency:local:env');
const command = spawnSync(process.execPath, [manager, 'exec', 'supabase', 'status', '--output', 'env'], { encoding: 'utf8' });
if (command.status !== 0) throw new Error('Start the pinned local Supabase stack before configuring .env');
const status = command.stdout.trim().startsWith('{') ? JSON.parse(command.stdout) : dotenv.parse(command.stdout);
const values = { SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_S3_ACCESS_KEY_ID: status.S3_PROTOCOL_ACCESS_KEY_ID, SUPABASE_S3_SECRET_ACCESS_KEY: status.S3_PROTOCOL_ACCESS_KEY_SECRET,
  SUPABASE_STORAGE_REGION: status.S3_PROTOCOL_REGION || 'local' };
if (Object.values(values).some(value => typeof value !== 'string' || !value)) throw new Error('Supabase status did not include the required local settings');
let text = existsSync('.env') ? readFileSync('.env', 'utf8') : readFileSync('.env.agency.example', 'utf8');
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm'); text = pattern.test(text) ? text.replace(pattern, () => line) : text + '\n' + line;
}
writeFileSync('.env', text);
console.log('Updated local Supabase settings in the ignored .env file. Restart the app services to load them.');
