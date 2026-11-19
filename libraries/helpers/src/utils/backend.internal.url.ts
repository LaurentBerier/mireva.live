export function backendInternalUrl() {
  if (process.env.AUTH_PROVIDER === 'supabase' && process.env.VERCEL_ENV === 'preview') {
    if (!process.env.STAGING_BACKEND_INTERNAL_URL) throw new Error('Preview deployments require STAGING_BACKEND_INTERNAL_URL');
    return process.env.STAGING_BACKEND_INTERNAL_URL.replace(/\/$/, '');
  }
  if (!process.env.BACKEND_INTERNAL_URL) throw new Error('BACKEND_INTERNAL_URL is required');
  return process.env.BACKEND_INTERNAL_URL.replace(/\/$/, '');
}
