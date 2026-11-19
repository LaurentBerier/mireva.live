import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';

const local = process.argv.includes('--local');
const url = process.env.SUPABASE_URL;
const email = process.env.AGENCY_OWNER_EMAIL?.trim().toLowerCase();
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY || !email) throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and AGENCY_OWNER_EMAIL in .env');
if (local && !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('--local is restricted to a local Supabase instance');
const auth = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const database = new PrismaClient();
try {
  let user = await database.user.findFirst({ where: { email, supabaseId: { not: null }, deletedAt: null }, select: { id: true, supabaseId: true } });
  if (!user) {
    const password = local ? randomBytes(24).toString('base64url') : undefined;
    const result = local ? await auth.auth.admin.createUser({ email, password, email_confirm: true })
      : await auth.auth.admin.inviteUserByEmail(email, { redirectTo: `${process.env.FRONTEND_URL}/auth/callback?next=/auth/set-password` });
    if (result.error || !result.data.user) throw new Error(result.error?.message || 'Owner invitation failed');
    user = await database.user.create({ data: { email, supabaseId: result.data.user.id, providerName: 'GENERIC', providerId: result.data.user.id, activated: true, timezone: 0, timezoneName: 'America/Toronto' }, select: { id: true, supabaseId: true } });
    if (local) { mkdirSync('.secrets', { recursive: true }); writeFileSync('.secrets/agency-local-owner.json', JSON.stringify({ email, password }, null, 2)); }
  }
  let agency = await database.agencyWorkspace.findFirst({ where: { members: { some: { userId: user.id, role: 'SUPERADMIN' } } } });
  if (!agency) agency = await database.agencyWorkspace.create({ data: { name: process.env.AGENCY_NAME || 'My Agency', members: { create: { userId: user.id, role: 'SUPERADMIN' } } } });
  const brand = await database.organization.findFirst({ where: { agencyId: agency.id } });
  if (!brand) await database.organization.create({ data: { agencyId: agency.id, name: process.env.AGENCY_FIRST_BRAND || 'My Brand', approvalRequired: true, timezoneName: 'America/Toronto', users: { create: { userId: user.id, role: 'SUPERADMIN' } } } });
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'agency-media';
  const existing = await auth.storage.getBucket(bucket);
  if (existing.data?.public) throw new Error('The configured media bucket is public. Set it to private before continuing.');
  if (!existing.data) {
    const { error } = await auth.storage.createBucket(bucket, { public: false, fileSizeLimit: 1073741824, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/tiff', 'video/mp4', 'application/json', 'text/plain'] });
    if (error) throw new Error(error.message);
  }
  console.log(local ? 'Local owner, agency, brand, and private storage are ready. Development credentials are in .secrets/agency-local-owner.json.' : 'Owner invitation, agency, brand, and private storage are ready.');
} finally { await database.$disconnect(); }
