import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function supabaseProxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  if (path === '/auth/callback' || path.startsWith('/s/') || path.startsWith('/r/') || path.startsWith('/provider/') || path.startsWith('/integrations/connect/') ||
      (path.startsWith('/integrations/social/') && !request.nextUrl.searchParams.get('state')?.startsWith('login'))) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return path.startsWith('/auth') ? response : NextResponse.redirect(new URL('/auth/login', request.url));
  const client = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: { getAll: () => request.cookies.getAll(), setAll: values => {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (path === '/auth/logout') {
    await client.auth.signOut();
    const redirect = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.cookies.delete('auth'); redirect.cookies.delete('showorg');
    return redirect;
  }
  if (!user) {
    response.cookies.delete('auth');
    if (path.startsWith('/auth')) return response;
    const login = new URL('/auth/login', request.url);
    login.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    request.cookies.set('auth', session.access_token);
    const refreshed = NextResponse.next({ request });
    response.cookies.getAll().forEach(cookie => refreshed.cookies.set(cookie));
    refreshed.cookies.set('auth', session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: session.expires_in });
    response = refreshed;
  }
  if ((path === '/auth' || path === '/auth/login' || path === '/') && user) {
    const redirect = NextResponse.redirect(new URL('/agency', request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}
