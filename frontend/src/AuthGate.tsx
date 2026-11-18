import {createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {cloud, setCloudActive} from './cloud';
import {initializeAuth} from './auth-bootstrap';
import {authRedirect} from './auth-links';
import {pendingInvitation} from './invitation-links';
import {JoinInvitation} from './Relationships';
import {CircleAlert, CircleCheck, Hourglass} from 'lucide-react';
import {Button, Field, Icon, type LucideIcon} from './ui';

type Screen = 'checking' | 'preview' | 'login' | 'signup' | 'reset' | 'password' | 'pending' | 'invitee' | 'cloud';

/* Presentation of the status line. Decided by message key, never by its text. */
type MessageTone = 'none' | 'error' | 'pending' | 'success';

const errorMessages = new Set([
  'authError',
  'authActionError',
  'authUnavailable',
  'authLinkError',
  'authLinkExpired',
  'authLinkBrowser',
  'passwordMismatch',
]);

const toneIcons: Record<Exclude<MessageTone, 'none'>, LucideIcon> = {
  error: CircleAlert,
  pending: Hourglass,
  success: CircleCheck,
};

function messageTone(message: string): MessageTone {
  if (!message) return 'none';
  if (errorMessages.has(message)) return 'error';
  if (message === 'betaPending') return 'pending';
  return 'success';
}

/**
 * What the application shell needs to render the single account control.
 * The shell shows the "signOut" string in cloud mode and "cloudAccount" in the
 * fictional preview; `act` signs out or opens the sign-in screen respectively.
 */
export interface AccountControl {
  mode: 'cloud' | 'preview';
  /** False when no cloud project is configured; the control is then not rendered. */
  available: boolean;
  busy: boolean;
  act: () => void;
  /** The verified account's email in cloud mode; null in the fictional preview. */
  email: string | null;
}

const AccountContext = createContext<AccountControl | null>(null);

/** Null outside AuthGate's signed-in or preview states. */
export function useAccount() {
  return useContext(AccountContext);
}

export default function AuthGate({children}: {children: ReactNode}) {
  const {t} = useTranslation();
  const [screen, setScreen] = useState<Screen>('checking');
  const [sessionKey, setSessionKey] = useState('preview');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const recovery = useRef(false);
  const signedOutDestination = useRef<'preview' | 'login'>('preview');
  const recheck = useRef<() => void>(() => undefined);

  useEffect(() => {
    let stopped = false;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function checkSession() {
      const ticket = ++sequence.current;
      setCloudActive(false);
      setScreen('checking');
      try {
        const session = await cloud?.auth.getSession();
        if (stopped || ticket !== sequence.current) return;
        if (!session?.data.session) {
          setSessionKey('preview'); setScreen(pendingInvitation() ? 'login' : signedOutDestination.current); return;
        }
        const user = session.data.session.user;
        if (recovery.current) {
          setSessionKey(user.id); setScreen('password'); return;
        }
        const access = await cloud!.rpc('has_beta_access');
        if (stopped || ticket !== sequence.current) return;
        setSessionKey(user.id);
        if (access.error) {
          setScreen('login'); setMessage('authUnavailable');
        } else if (access.data === true) {
          setCloudActive(true, user.id); setAccountEmail(user.email ?? null); setScreen('cloud'); setMessage('');
        } else if (pendingInvitation()) {
          // Not admitted yet, but holding an invitation. Accepting a valid,
          // recipient-bound invitation is the one action the server allows before
          // admission, and it admits this account. Nothing else is rendered.
          setCloudActive(true, user.id); setScreen('invitee'); setMessage('');
        } else {
          setScreen('pending'); setMessage('betaPending');
        }
      } catch {
        if (!stopped && ticket === sequence.current) {
          setScreen('login'); setMessage('authUnavailable');
        }
      }
    }
    const subscription = cloud?.auth.onAuthStateChange((event) => {
      // Bootstrap checks the initial session itself. A late INITIAL_SESSION must
      // not dismiss a callback error or a recovery screen.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') recovery.current = true;
      if (event === 'SIGNED_OUT') recovery.current = false;
      // Awaiting Supabase inside this callback can deadlock its auth lock.
      if (ready && !stopped) {
        ++sequence.current;
        setCloudActive(false); setScreen('checking');
        clearTimeout(timer);
        timer = setTimeout(() => void checkSession(), 0);
      }
    });
    recheck.current = () => {
      if (stopped) return;
      ++sequence.current;
      setCloudActive(false); setScreen('checking');
      clearTimeout(timer);
      timer = setTimeout(() => void checkSession(), 0);
    };
    void initializeAuth().then(async result => {
      if (stopped) return;
      ready = true;
      if (result === 'authLinkError' || result === 'authLinkExpired' || result === 'authLinkBrowser') {
        setCloudActive(false); setScreen('login'); setMessage(result);
      } else {
        recovery.current = result === 'recovery';
        await checkSession();
      }
    });
    return () => {
      stopped = true; ++sequence.current; clearTimeout(timer);
      setCloudActive(false); subscription?.data.subscription.unsubscribe();
    };
  }, []);

  function navigate(next: Screen) {
    setPassword(''); setConfirmation(''); setMessage(''); setScreen(next);
  }

  async function submit() {
    if (!cloud) return;
    setBusy(true); setMessage('');
    const enteredPassword = password;
    try {
      if (screen === 'signup') {
        const result = await cloud.auth.signUp({email: email.trim(), password: enteredPassword,
          options: {emailRedirectTo: authRedirect(window.location.origin)}});
        setMessage(result.error ? 'authActionError' : 'confirmationSent');
      } else if (screen === 'reset') {
        const result = await cloud.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirect(window.location.origin, 'recovery'),
        });
        setMessage(result.error ? 'authActionError' : 'recoverySent');
      } else if (screen === 'password') {
        if (enteredPassword !== confirmation) { setMessage('passwordMismatch'); return; }
        const result = await cloud.auth.updateUser({password: enteredPassword});
        if (result.error) setMessage('authActionError');
        else {
          recovery.current = false;
          signedOutDestination.current = 'login';
          await cloud.auth.signOut({scope: 'local'});
          setCloudActive(false); setScreen('login'); setMessage('passwordUpdated');
        }
      } else {
        const result = await cloud.auth.signInWithPassword({email: email.trim(), password: enteredPassword});
        if (result.error) setMessage('authError');
      }
    } catch { setMessage('authUnavailable'); }
    finally { setPassword(''); setConfirmation(''); setBusy(false); }
  }

  async function googleLogin() {
    if (!cloud) return;
    setBusy(true); setMessage(''); setPassword('');
    try {
      const {error} = await cloud.auth.signInWithOAuth({provider: 'google', options: {
        redirectTo: authRedirect(window.location.origin), scopes: 'openid email profile',
      }});
      if (error) setMessage('authActionError');
    } catch { setMessage('authUnavailable'); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!cloud) return;
    ++sequence.current;
    setCloudActive(false); setScreen('checking'); setBusy(true);
    recovery.current = false;
    signedOutDestination.current = 'preview';
    try {
      const {error} = await cloud.auth.signOut({scope: 'local'});
      navigate(error ? 'login' : 'preview');
      if (error) setMessage('authUnavailable');
    } catch { setScreen('login'); setMessage('authUnavailable'); }
    finally { setBusy(false); }
  }

  // Presentation only: the brand line shared by every signed-out screen.
  const brand = (
    <p className="auth-brand">
      <span className="brand-mark" aria-hidden="true">
        {'◒'}
      </span>
      <span className="auth-brand__title">{t('appTitle')}</span>
    </p>
  );

  // The one role="status" element of a screen. It is always rendered and keeps
  // its space when empty; the tone comes from the message key, never its text.
  const tone = messageTone(message);
  const status = (
    <p className="auth-status" role="status" data-tone={tone}>
      {tone !== 'none' && <Icon icon={toneIcons[tone]} className="auth-status__icon" />}
      {message ? <span className="auth-status__text">{t(message)}</span> : ''}
    </p>
  );

  if (screen === 'checking') {
    return (
      <main className="auth auth--checking" aria-busy="true">
        {brand}
        <p className="auth-checking" role="status">
          {t('checkingAccount')}
        </p>
      </main>
    );
  }

  if (screen === 'invitee') {
    return (
      <main className="auth auth--invitee">
        {brand}
        <JoinInvitation
          onJoined={() => {
            try {
              sessionStorage.setItem('companion.open-tab', 'relationships');
            } catch {
              /* Storage is optional. */
            }
            recheck.current();
          }}
          onDismissed={() => recheck.current()}
        />
        <div className="auth-links">
          <Button disabled={busy} onClick={() => void logout()}>
            {t('signOut')}
          </Button>
        </div>
      </main>
    );
  }

  if (screen === 'pending') {
    return (
      <main className="auth">
        {brand}
        <header className="auth-header">
          <h1 className="auth-title">{t('cloudAccount')}</h1>
        </header>
        {status}
        <p className="auth-lead">{t('betaExplanation')}</p>
        <div className="auth-links">
          <Button disabled={busy} onClick={() => void logout()}>
            {t('signOut')}
          </Button>
        </div>
      </main>
    );
  }

  if (['login', 'signup', 'reset', 'password'].includes(screen)) {
    const title =
      screen === 'signup'
        ? 'createAccount'
        : screen === 'reset'
          ? 'forgotPassword'
          : screen === 'password'
            ? 'setPassword'
            : 'signIn';
    const hint =
      screen === 'signup' || screen === 'password' ? t('passwordHint') : undefined;
    return (
      <main className="auth">
        {brand}
        <header className="auth-header">
          <h1 className="auth-title">{t(title)}</h1>
          <p className="auth-lead">{t('cloudSetup')}</p>
        </header>
        <form
          className="auth-form"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {screen !== 'password' && (
            <Field label={t('email')}>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          )}
          {screen !== 'reset' && (
            <Field label={t(screen === 'password' ? 'newPassword' : 'password')} hint={hint}>
              <input
                type="password"
                required
                minLength={screen === 'login' ? undefined : 12}
                maxLength={256}
                autoComplete={screen === 'login' ? 'current-password' : 'new-password'}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          {screen === 'password' && (
            <Field label={t('confirmPassword')}>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmation}
                disabled={busy}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </Field>
          )}
          <Button type="submit" variant="primary" block disabled={busy || !cloud}>
            {t(screen === 'reset' ? 'sendRecovery' : title)}
          </Button>
          {status}
          {screen === 'login' && (
            <Button block disabled={busy || !cloud} onClick={() => void googleLogin()}>
              {t('continueGoogle')}
            </Button>
          )}
          <div className="auth-links">
            {screen === 'login' && (
              <>
                <Button className="auth-link" disabled={busy} onClick={() => navigate('signup')}>
                  {t('createAccount')}
                </Button>
                <Button className="auth-link" disabled={busy} onClick={() => navigate('reset')}>
                  {t('forgotPassword')}
                </Button>
              </>
            )}
            {screen !== 'login' && (
              <Button
                className="auth-link"
                disabled={busy}
                onClick={() => (screen === 'password' ? void logout() : navigate('login'))}
              >
                {t(screen === 'password' ? 'signOut' : 'backSignIn')}
              </Button>
            )}
            {screen !== 'password' && (
              <Button className="auth-link" disabled={busy} onClick={() => navigate('preview')}>
                {t('localPreview')}
              </Button>
            )}
          </div>
        </form>
      </main>
    );
  }
  const account: AccountControl = {
    mode: screen === 'cloud' ? 'cloud' : 'preview',
    available: cloud !== null,
    busy,
    act: () => screen === 'cloud' ? void logout() : navigate('login'),
    email: screen === 'cloud' ? accountEmail : null,
  };
  // The key remounts the application whenever the account or mode changes.
  return <AccountContext.Provider value={account}><Fragment key={screen + sessionKey}>{children}</Fragment></AccountContext.Provider>;
}
