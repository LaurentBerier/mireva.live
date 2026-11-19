'use client';
import { useEffect } from 'react';
import { useVariables } from '@gitroom/react/helpers/variable.context';
export function AgencySessionKeeper(): null {
  const { supabaseAuth } = useVariables();
  useEffect(() => {
    if (!supabaseAuth) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
        });
        if (response.status === 401) window.location.assign('/auth/login');
      } catch {
        /* Offline views retain their state until connectivity returns. */
      }
    };
    const interval = window.setInterval(refresh, 240000);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [supabaseAuth]);
  return null;
}
