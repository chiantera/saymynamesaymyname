export type AuthIntent = 'signin' | 'recovery';
export type AuthLinkFailure = 'authLinkError' | 'authLinkExpired' | 'authLinkBrowser';

export function authLinkFailure(code: unknown): AuthLinkFailure {
  if (typeof code === 'string' && ['flow_state_expired', 'flow_state_not_found', 'otp_expired'].includes(code)) return 'authLinkExpired';
  if (code === 'pkce_code_verifier_not_found') return 'authLinkBrowser';
  return 'authLinkError';
}

// Fixed, same-origin routes; never accept a caller-supplied `next` URL.
export function authRedirect(origin: string, intent: AuthIntent = 'signin'): string {
  return new URL(intent === 'recovery' ? '/auth/recovery' : '/auth/callback', origin).href;
}

export function readAuthCallback(href: string) {
  const url = new URL(href);
  if (!['/auth/callback', '/auth/recovery'].includes(url.pathname)) return null;
  return {
    recovery: url.pathname === '/auth/recovery', code: url.searchParams.get('code'),
    flowId: url.searchParams.get('sb_flow_id'),
    errorCode: url.searchParams.get('error_code'),
    // Provider descriptions may contain private data; show static copy instead.
    failed: url.searchParams.has('error') || url.searchParams.has('error_code'),
  };
}
