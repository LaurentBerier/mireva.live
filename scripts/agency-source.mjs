import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const root = process.cwd();
const output = resolve('deploy/corresponding-source.tar.gz');
const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
if (listed.status !== 0) throw new Error('Generate the source bundle from the fork checkout before building the image');
const files = listed.stdout.split('\0').filter(Boolean).filter(file =>
  !file.startsWith('reports/') && !file.startsWith('.tools/') && !file.startsWith('.secrets/') &&
  !file.startsWith('supabase/.temp/') && !file.startsWith('supabase/.branches/') &&
  !file.endsWith('.log') && !file.endsWith('.dump') && file !== 'deploy/corresponding-source.tar.gz' &&
  (!file.split('/').pop().startsWith('.env') || file.endsWith('.example')));
if (!files.includes('LICENSE') || !files.includes('pnpm-lock.yaml')) throw new Error('The source bundle must include the license and lockfile');
for (const file of files) if (relative(root, resolve(file)).startsWith('..')) throw new Error('Invalid source path');
mkdirSync('.tools', { recursive: true }); mkdirSync('deploy', { recursive: true });
writeFileSync('.tools/agency-source-files.txt', files.join('\0') + '\0');
const archived = spawnSync('tar', ['-czf', output, '--null', '-T', '.tools/agency-source-files.txt'], { encoding: 'utf8' });
if (archived.status !== 0) throw new Error(archived.stderr || 'Source archive failed');
console.log(`Created the corresponding source bundle from ${files.length} source files`);
