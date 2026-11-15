export type AuthIntent = 'signin' | 'recovery';

// Fixed, same-origin routes; never accept a caller-supplied `next` URL.
export function authRedirect(origin: string, intent: AuthIntent = 'signin'): string {
  return new URL(intent === 'recovery' ? '/auth/recovery' : '/auth/callback', origin).href;
}

export function readAuthCallback(href: string) {
  const url = new URL(href);
  if (!['/auth/callback', '/auth/recovery'].includes(url.pathname)) return null;
  return {
    recovery: url.pathname === '/auth/recovery', code: url.searchParams.get('code'),
    // Provider descriptions may contain private data; show static copy instead.
    failed: url.searchParams.has('error') || url.searchParams.has('error_code'),
  };
}
