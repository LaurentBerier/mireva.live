import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const manager = process.env.npm_execpath;
if (!manager) throw new Error('Run this through pnpm run agency:dev');
const children = [
  spawn(process.execPath, [resolve('scripts/agency-run-service.cjs'), 'backend'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [resolve('scripts/agency-run-service.cjs'), 'orchestrator'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [manager, '--filter', 'postiz-frontend', 'dev'], { stdio: 'inherit', env: process.env }),
];
const stop = () => children.forEach(child => child.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (const child of children) child.on('exit', code => { if (code) { stop(); process.exitCode = code; } });
