const KEY = 'companion.pending-invitation';
const TOKEN = /^[a-f0-9]{64}$/;
let captureProblem = false;

export function invitationToken(href: string): string | null {
  const url = new URL(href);
  if (url.pathname !== '/join') return null;
  const match = /^#invite=([a-f0-9]{64})$/.exec(url.hash);
  return match?.[1] ?? null;
}

export function invitationLink(origin: string, token: string): string {
  if (!TOKEN.test(token)) throw new Error('Invalid invitation');
  const url = new URL('/join', origin);
  url.hash = `invite=${token}`;
  return url.href;
}

export function captureInvitation() {
  if (window.location.pathname !== '/join' || !window.location.hash) return;
  const token = invitationToken(window.location.href);
  // Fragment secrets never reach the web server; remove them from browser history too.
  window.history.replaceState(null, '', '/join');
  try {
    if (!token) { captureProblem = true; sessionStorage.removeItem(KEY); return; }
    sessionStorage.setItem(KEY, JSON.stringify({token, savedAt: Date.now()}));
  } catch { captureProblem = true; }
}

export function pendingInvitation(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.token === 'string' && TOKEN.test(value.token) &&
      Number.isFinite(value.savedAt) && Date.now() - value.savedAt >= 0 &&
      Date.now() - value.savedAt < 7 * 86400000) return value.token;
    sessionStorage.removeItem(KEY);
  } catch { /* No persistent fallback: reopening the original link is safe. */ }
  return null;
}

export function invitationProblem() { return captureProblem; }
export function clearInvitation() {
  try { sessionStorage.removeItem(KEY); } catch { /* Browser storage is optional. */ }
  captureProblem = false;
  if (window.location.pathname === '/join') window.history.replaceState(null, '', '/');
}
