import {cloud} from './cloud';
import {readAuthCallback} from './auth-links';

type ReturnState = 'none' | 'signed-in' | 'recovery' | 'error';
let initialization: Promise<ReturnState> | undefined;

export function initializeAuth(): Promise<ReturnState> {
  return initialization ??= (async () => {
    const callback = readAuthCallback(window.location.href);
    if (!callback) return 'none';
    window.history.replaceState(null, '', '/');
    if (!cloud || callback.failed || !callback.code) return 'error';
    try {
      const {data, error} = await cloud.auth.exchangeCodeForSession(callback.code);
      if (error || !data.session) return 'error';
      // A completed PKCE exchange is required; the fixed route only selects UI.
      return callback.recovery ? 'recovery' : 'signed-in';
    } catch { return 'error'; }
  })();
}
