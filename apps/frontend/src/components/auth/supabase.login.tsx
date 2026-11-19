'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';

export function SupabaseLogin({ mode = 'login' }: { mode?: 'login' | 'forgot' | 'password' }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    fields.returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/agency';
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      const result = await response.json();
      if (!response.ok || mode === 'forgot') { setMessage(result.message || 'Please try again'); return; }
      window.location.assign(result.next || '/agency');
    } catch { setMessage('Unable to reach the server. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="flex w-full flex-col gap-5 text-base">
    <div><h1 className="text-3xl font-semibold">{mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Reset your password' : 'Set your password'}</h1>
      <p className="mt-3 text-sm opacity-70">{mode === 'login' ? 'Sign in to your agency workspace. Ask your agency administrator for an invitation.' : 'Use your invited agency account.'}</p></div>
    {mode !== 'password' && <label className="flex flex-col gap-2">Email<input name="email" type="email" autoComplete="email" required maxLength={254} className="rounded-lg border border-white/20 bg-transparent p-3" /></label>}
    {mode !== 'forgot' && <label className="flex flex-col gap-2">Password<input name="password" type="password" autoComplete={mode === 'password' ? 'new-password' : 'current-password'} minLength={8} required className="rounded-lg border border-white/20 bg-transparent p-3" /></label>}
    {message && <p role="status" className="rounded-lg border border-white/20 p-3">{message}</p>}
    <button disabled={busy} className="rounded-lg bg-[#612bd3] p-3 font-semibold disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send recovery link' : 'Save password'}</button>
    <Link className="text-sm underline" href={mode === 'login' ? '/auth/forgot' : '/auth/login'}>{mode === 'login' ? 'Forgot password?' : 'Back to sign in'}</Link>
  </form>;
}
