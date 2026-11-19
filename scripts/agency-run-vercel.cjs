const service = process.argv[2];
if (!['backend', 'orchestrator'].includes(service)) throw new Error('Expected backend or orchestrator');

// Marketplace injects KV_URL. Canonicalize both inputs before ioredis sees them;
// query options can override ioredis's TLS default even with a rediss scheme.
const marketplaceRedis = !process.env.REDIS_URL && !!process.env.KV_URL;
const rawRedis = process.env.REDIS_URL || process.env.KV_URL;
if (rawRedis) {
  try {
    const connection = new URL(rawRedis.trim());
    if (marketplaceRedis && connection.protocol === 'redis:') connection.protocol = 'rediss:';
    if (connection.protocol !== 'rediss:' || !connection.hostname || connection.search || connection.hash) throw new Error();
    process.env.REDIS_URL = connection.toString();
  } catch { throw new Error('Managed Redis requires a TLS rediss:// connection without URL options'); }
}

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET',
  'ENCRYPTION_KEY', 'REDIS_URL', 'TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE', 'TEMPORAL_API_KEY',
  'SUPABASE_STORAGE_BUCKET', 'SUPABASE_STORAGE_REGION', 'SUPABASE_S3_ACCESS_KEY_ID', 'SUPABASE_S3_SECRET_ACCESS_KEY'];
if (service === 'backend') required.push('PORT');
const missing = required.filter(key => !process.env[key]?.trim());
if (missing.length) throw new Error(`Vercel backend configuration is incomplete: ${missing.join(', ')}`);
if (process.env.TEMPORAL_TLS !== 'true') throw new Error('Managed Temporal requires TEMPORAL_TLS=true');
if (process.env.AUTH_PROVIDER !== 'supabase') throw new Error('Vercel agency deployments require Supabase Auth');
if (process.env.STORAGE_PROVIDER !== 'supabase') throw new Error('Vercel agency deployments require private Supabase storage');
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
if (process.env.ENCRYPTION_PROVIDER !== 'local' || encryptionKey.length !== 32 || encryptionKey.toString('base64') !== process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_READ_ONLY === 'true') {
  throw new Error('Vercel agency deployments require local encryption with a base64-encoded 32-byte key and writes enabled');
}

if (process.env.VERCEL_ENV === 'preview') {
  if (process.env.DEPLOYMENT_ENVIRONMENT !== 'staging') throw new Error('Preview API deployments require an isolated staging environment');
  const writes = ['PUBLISHING_ENABLED', 'ENGAGEMENT_ENABLED', 'ADS_WRITES_ENABLED', 'RUN_AGENCY_SYNC', 'RUN_CRON'];
  if (service === 'orchestrator' || writes.some(key => process.env[key] === 'true')) {
    throw new Error('Preview deployments cannot run workers or live jobs');
  }
}
require('./agency-run-service.cjs');
