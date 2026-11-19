import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import Redis from 'ioredis';
import { backendInternalUrl } from '@gitroom/helpers/utils/backend.internal.url';

const entrypoint = readFileSync(resolve('scripts/agency-run-vercel.cjs'), 'utf8');
const fixture = {
  AUTH_PROVIDER: 'supabase', DATABASE_URL: 'postgresql://test:private-fixture@localhost/test',
  SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-fixture',
  JWT_SECRET: 'private-fixture', ENCRYPTION_KEY: '01'.repeat(32), ENCRYPTION_PROVIDER: 'local',
  STORAGE_PROVIDER: 'supabase', SUPABASE_STORAGE_BUCKET: 'fixture-media', SUPABASE_STORAGE_REGION: 'us-west-2',
  SUPABASE_S3_ACCESS_KEY_ID: 'private-fixture', SUPABASE_S3_SECRET_ACCESS_KEY: 'private-fixture', PORT: '3000',
  REDIS_URL: 'rediss://test:private-fixture@redis.example.test:6379',
  TEMPORAL_ADDRESS: 'fixture.tmprl.cloud:7233', TEMPORAL_NAMESPACE: 'fixture',
  TEMPORAL_API_KEY: 'private-fixture', TEMPORAL_TLS: 'true',
  VERCEL_ENV: 'production', DEPLOYMENT_ENVIRONMENT: 'production',
};

function launch(env: Record<string, string> = {}, service = 'backend') {
  const load = jest.fn();
  const environment = { ...fixture, ...env };
  runInNewContext(entrypoint, { process: { argv: ['node', 'entry', service], env: environment }, URL, require: load });
  return Object.assign(load, { environment });
}

describe('Vercel deployment boundaries', () => {
  it('requires real managed dependencies before loading the backend', () => {
    expect(() => launch({ REDIS_URL: '', TEMPORAL_API_KEY: '' })).toThrow(/REDIS_URL, TEMPORAL_API_KEY/);
    expect(launch()).toHaveBeenCalledWith('./agency-run-service.cjs');
  });

  it('rejects plaintext and malformed Redis configuration without leaking its value', () => {
    for (const value of ['redis://test:private-fixture@localhost:6379', 'private-fixture']) {
      try { launch({ REDIS_URL: value }); throw new Error('Startup unexpectedly accepted invalid Redis'); }
      catch (error) {
        expect(error.message).toBe('Managed Redis requires a TLS rediss:// connection without URL options');
        expect(error.message).not.toContain('private-fixture');
      }
    }
    expect(() => launch({ TEMPORAL_TLS: 'false' })).toThrow('Managed Temporal requires TEMPORAL_TLS=true');
  });

  it('uses the Marketplace TCP credential over TLS without requiring a plaintext secret copy', () => {
    for (const env of [
      { REDIS_URL: '', KV_URL: 'redis://default:private-fixture@redis.example.test:6379' },
      { REDIS_URL: '  rediss://default:private-fixture@redis.example.test:6379  ' },
    ]) {
      const loaded = launch(env);
      const redis = new Redis(loaded.environment.REDIS_URL, { lazyConnect: true });
      try {
        expect(loaded.environment.REDIS_URL.startsWith('rediss://')).toBe(true);
        expect(redis.options.tls).toBeTruthy();
        expect(typeof redis.options.tls).not.toBe('string');
      } finally { redis.disconnect(); }
    }
    for (const env of [
      { REDIS_URL: '', KV_URL: 'https://private-fixture@example.test' },
      { REDIS_URL: '', KV_URL: 'redis://redis.example.test:6379?tls=' },
      { REDIS_URL: 'rediss://redis.example.test:6379?tls=false' },
    ]) expect(() => launch(env)).toThrow('TLS rediss:// connection without URL options');
  });

  it('blocks production configuration, live jobs and workers in previews', () => {
    expect(() => launch({ VERCEL_ENV: 'preview' })).toThrow('isolated staging');
    const staging = { VERCEL_ENV: 'preview', DEPLOYMENT_ENVIRONMENT: 'staging' };
    expect(launch(staging)).toHaveBeenCalledTimes(1);
    expect(() => launch(staging, 'orchestrator')).toThrow('cannot run workers');
    for (const flag of ['PUBLISHING_ENABLED', 'ENGAGEMENT_ENABLED', 'ADS_WRITES_ENABLED', 'RUN_AGENCY_SYNC', 'RUN_CRON']) {
      expect(() => launch({ ...staging, [flag]: 'true' })).toThrow('cannot run workers or live jobs');
    }
  });

  it('keeps the publishing daemon stopped until capacity and credentials are verified', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
    expect(Object.values(config.daemons.publisher.instances)).toEqual([0]);
    expect(config.daemons.publisher.command).toEqual(['node', 'scripts/agency-run-vercel.cjs', 'orchestrator']);
    expect(config.rewrites[0].destination.service).toBe('api');
  });

  it('rejects ephemeral storage and unencrypted social-credential storage', () => {
    expect(() => launch({ STORAGE_PROVIDER: '' })).toThrow('private Supabase storage');
    expect(() => launch({ ENCRYPTION_PROVIDER: '' })).toThrow('local encryption');
    expect(() => launch({ ENCRYPTION_KEY: 'invalid' })).toThrow('hexadecimal key');
    expect(() => launch({ ENCRYPTION_READ_ONLY: 'true' })).toThrow('writes enabled');
    expect(() => launch({ SUPABASE_S3_SECRET_ACCESS_KEY: '' })).toThrow('SUPABASE_S3_SECRET_ACCESS_KEY');
    expect(() => launch({ PORT: '' })).toThrow('PORT');
  });

  it('passes the original Postiz paths to Nest for browser API calls and private binding calls', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
    for (const [incoming, expected] of [
      ['/api/backend/user/self', '/user/self'], ['/api/backend/agency/reviews', '/agency/reviews'],
      ['/api/backend', '/'], ['/api/backend/', '/'], ['/user/self', '/user/self'],
    ]) {
      const route = config.services.api.routes.find((candidate: any) => new RegExp(`^${candidate.src}$`).test(incoming));
      const observed = route ? incoming.replace(new RegExp(`^${route.src}$`), route.transforms[0].args) : incoming;
      expect(observed).toBe(expected);
    }
  });

  it('preserves root MCP discovery/transports while keeping OAuth consent on the frontend', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
    const routes = new Map(config.rewrites.map((route: any) => [route.source, route.destination.service]));
    for (const path of ['/mcp/:path*', '/sse/:path*', '/message/:path*', '/mcp-oauth-chatgpt', '/mcp-oauth-claude',
      '/mcp-oauth-dynamic', '/mcp-oauth', '/.well-known/oauth-protected-resource/:path*',
      '/.well-known/oauth-authorization-server/:path*', '/.well-known/openid-configuration/:path*']) {
      expect(routes.get(path)).toBe('api');
    }
    expect(config.rewrites[config.rewrites.length - 1]).toEqual({ source: '/:path*', destination: { service: 'web' } });
    expect(config.rewrites.some((route: any) => route.destination.service === 'api' && route.source.startsWith('/oauth'))).toBe(false);
  });

  it('uses the deployment binding for Services previews and an explicit staging URL for split deployments', () => {
    const before = { ...process.env };
    try {
      process.env.AUTH_PROVIDER = 'supabase'; process.env.VERCEL_ENV = 'preview';
      process.env.BACKEND_INTERNAL_URL = 'https://current-preview-api.example.test/';
      delete process.env.STAGING_BACKEND_INTERNAL_URL;
      delete process.env.VERCEL_SERVICES;
      expect(() => backendInternalUrl()).toThrow('STAGING_BACKEND_INTERNAL_URL');
      process.env.VERCEL_SERVICES = 'true';
      expect(backendInternalUrl()).toBe('https://current-preview-api.example.test');
      delete process.env.BACKEND_INTERNAL_URL;
      expect(() => backendInternalUrl()).toThrow('BACKEND_INTERNAL_URL is required');
    } finally {
      process.env = before;
    }
  });
});
