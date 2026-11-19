import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { resolve } from 'path';
import base from './vite.config';
import manifest from './manifest.json';
import { writeFileSync } from 'fs';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, resolve(__dirname, '../..'), ''), ...process.env };
  const origins = (env.AGENCY_EXTENSION_ORIGINS || env.FRONTEND_URL || '').split(',').filter(Boolean).map(value => {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Extension origins require HTTPS or loopback');
    return url.origin;
  });
  if (!origins.length) throw new Error('Configure FRONTEND_URL before building the agency extension');
  const backends = origins.map(origin => new URL(env.NEXT_PUBLIC_BACKEND_URL || '/api/backend', origin).href.replace(/\/$/, ''));
  return mergeConfig(base, {
    define: { __AGENCY_ALLOWED_ORIGINS__: JSON.stringify(origins), __AGENCY_ALLOWED_BACKENDS__: JSON.stringify(backends) },
    plugins: [{ name: 'agency-extension-manifest', closeBundle() {
      writeFileSync(resolve(__dirname, 'dist/manifest.json'), JSON.stringify({ ...manifest,
        host_permissions: [...manifest.host_permissions, ...new Set(backends.map(url => `${new URL(url).origin}/*`))],
        externally_connectable: { matches: origins.map(origin => `${origin}/*`) },
      }, null, 2));
    } }],
  });
});
