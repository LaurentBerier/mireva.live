import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer, syncBackendSession } from '@gitroom/frontend/lib/supabase/server';

export async function GET(request: NextRequest) {
  const client = await supabaseServer();
  const query = request.nextUrl.searchParams;
  const code = query.get('code');
  const hash = query.get('token_hash');
  const type = query.get('type');
  const result = code ? await client.auth.exchangeCodeForSession(code)
    : hash && (type === 'invite' || type === 'recovery')
      ? await client.auth.verifyOtp({ token_hash: hash, type }) : null;
  if (!result || result.error || !result.data.session) return NextResponse.redirect(new URL('/auth/login?error=expired-link', request.url));
  await syncBackendSession(result.data.session.access_token, result.data.session.expires_in);
  (await cookies()).delete('showorg');
  const next = query.get('next') || '/agency';
  const target = new URL(next.startsWith('/') ? next : '/agency', request.url);
  return NextResponse.redirect(target.origin === request.nextUrl.origin ? target : new URL('/agency', request.url));
}
