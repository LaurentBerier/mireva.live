import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
for (const service of ['backend', 'orchestrator']) {
  const build = resolve(`apps/${service}/dist`);
  const scope = join(build, 'node_modules', '@gitroom');
  mkdirSync(scope, { recursive: true });
  const targets = { helpers: 'libraries/helpers/src', 'nestjs-libraries': 'libraries/nestjs-libraries/src',
    backend: 'apps/backend/src', orchestrator: 'apps/orchestrator/src', plugins: 'libraries/plugins/src', react: 'libraries/react-shared-libraries/src' };
  for (const [name, target] of Object.entries(targets)) {
    const destination = join(scope, name);
    const source = join(build, target);
    if (existsSync(source) && !existsSync(destination)) symlinkSync(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
  }
}
