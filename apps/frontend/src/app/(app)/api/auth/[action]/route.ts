import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer, syncBackendSession } from '@gitroom/frontend/lib/supabase/server';
import { backendInternalUrl } from '@gitroom/helpers/utils/backend.internal.url';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
  if (process.env.AUTH_PROVIDER !== 'supabase') return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const { action } = await context.params;
  const client = await supabaseServer();
  const body = await request.json().catch(() => ({}));
  if (action === 'brand') {
    if (typeof body.id !== 'string' || body.id.length > 100) return NextResponse.json({ message: 'Invalid brand' }, { status: 400 });
    const { data: { session } } = await client.auth.getSession();
    if (!session) return NextResponse.json({}, { status: 401 });
    const verified = await fetch(`${backendInternalUrl()}/agency/context`, { headers: {
      Authorization: `Bearer ${session.access_token}`, showorg: body.id,
    }, cache: 'no-store' });
    if (!verified.ok) return NextResponse.json({ message: 'Brand access denied' }, { status: 403 });
    (await cookies()).set('showorg', body.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 365 * 86400 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'login') {
    if (typeof body.email !== 'string' || typeof body.password !== 'string') return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    const { data, error } = await client.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error || !data.session) return NextResponse.json({ message: 'Unable to sign in with those credentials' }, { status: 401 });
    const backend = await fetch(`${backendInternalUrl()}/user/self`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store',
    });
    if (!backend.ok) {
      await client.auth.signOut();
      return NextResponse.json({ message: 'Your account needs an active brand invitation' }, { status: 403 });
    }
    await syncBackendSession(data.session.access_token, data.session.expires_in);
    const identity = await backend.json();
    (await cookies()).set('showorg', identity.orgId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 365 * 86400 });
    const target = new URL(typeof body.returnTo === 'string' && body.returnTo.startsWith('/') ? body.returnTo : '/agency', request.url);
    const next = target.origin === request.nextUrl.origin && !target.pathname.startsWith('/auth') ? target.pathname + target.search + target.hash : '/agency';
    return NextResponse.json({ ok: true, next });
  }
  if (action === 'forgot') {
    if (typeof body.email !== 'string') return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    await client.auth.resetPasswordForEmail(body.email, { redirectTo: `${process.env.FRONTEND_URL}/auth/callback?next=/auth/set-password` });
    return NextResponse.json({ message: 'If this account can receive recovery emails, a link has been sent.' });
  }
  if (action === 'password') {
    const { data } = await client.auth.getUser();
    if (!data.user) return NextResponse.json({ message: 'Open your invitation or recovery link first' }, { status: 401 });
    if (typeof body.password !== 'string' || body.password.length < 8) return NextResponse.json({ message: 'Use at least eight characters' }, { status: 400 });
    const { error } = await client.auth.updateUser({ password: body.password });
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    const { data: session } = await client.auth.getSession();
    if (session.session) await syncBackendSession(session.session.access_token, session.session.expires_in);
    return NextResponse.json({ ok: true });
  }
  if (action === 'logout') {
    await client.auth.signOut();
    (await cookies()).delete('auth');
    (await cookies()).delete('showorg');
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: 'Not found' }, { status: 404 });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if ((await context.params).action !== 'session' || process.env.AUTH_PROVIDER !== 'supabase') return NextResponse.json({}, { status: 404 });
  const client = await supabaseServer();
  const current = await client.auth.getSession();
  if (current.data.session?.expires_at && current.data.session.expires_at < Date.now() / 1000 + 300) await client.auth.refreshSession();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: session } = await client.auth.getSession();
  if (session.session) await syncBackendSession(session.session.access_token, session.session.expires_in);
  return NextResponse.json({ ok: true });
}
