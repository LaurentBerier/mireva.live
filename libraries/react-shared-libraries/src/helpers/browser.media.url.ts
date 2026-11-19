// Protected media uses the current frontend's host-only session, including Vercel previews.
export function browserMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.startsWith('/api/backend/media/private/') ? url.pathname : value;
  } catch { return value; }
}
