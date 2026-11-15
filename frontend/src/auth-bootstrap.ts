import {cloud} from './cloud';
import {authLinkFailure, readAuthCallback, type AuthLinkFailure} from './auth-links';

type ReturnState = 'none' | 'signed-in' | 'recovery' | AuthLinkFailure;
let initialization: Promise<ReturnState> | undefined;

export function initializeAuth(): Promise<ReturnState> {
  return initialization ??= (async () => {
    const callback = readAuthCallback(window.location.href);
    if (!callback) return 'none';
    window.history.replaceState(null, '', '/');
    if (!cloud || callback.failed || !callback.code) return authLinkFailure(callback.errorCode);
    try {
      // Preserve the exact flow slot before removing callback parameters from the URL.
      // Even an invalid/empty explicit ID must reach SDK validation, not borrow a slot.
      const {data, error} = await cloud.auth.exchangeCodeForSession(callback.code,
        callback.flowId !== null ? {flowId: callback.flowId} : undefined);
      if (error || !data.session) return authLinkFailure(error?.code);
      // A completed PKCE exchange is required; the fixed route only selects UI.
      return callback.recovery ? 'recovery' : 'signed-in';
    } catch { return 'authLinkError'; }
  })();
}
