import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {cloud, setCloudActive} from './cloud';
import {initializeAuth} from './auth-bootstrap';
import {authRedirect} from './auth-links';
import {pendingInvitation} from './invitation-links';

type Screen = 'checking' | 'preview' | 'login' | 'signup' | 'reset' | 'password' | 'pending' | 'cloud';

export default function AuthGate({children}: {children: ReactNode}) {
  const {t} = useTranslation();
  const [screen, setScreen] = useState<Screen>('checking');
  const [sessionKey, setSessionKey] = useState('preview');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const recovery = useRef(false);
  const signedOutDestination = useRef<'preview' | 'login'>('preview');

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
          setCloudActive(true, user.id); setScreen('cloud'); setMessage('');
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

  if (screen === 'checking') return <main className="auth-panel" aria-busy="true"><p role="status">{t('checkingAccount')}</p></main>;
  if (screen === 'pending') return <main className="auth-panel"><h1>{t('cloudAccount')}</h1><p role="status">{t(message)}</p><p>{t('betaExplanation')}</p><button disabled={busy} onClick={() => void logout()}>{t('signOut')}</button></main>;
  if (['login', 'signup', 'reset', 'password'].includes(screen)) {
    const title = screen === 'signup' ? 'createAccount' : screen === 'reset' ? 'forgotPassword' : screen === 'password' ? 'setPassword' : 'signIn';
    return <main className="auth-panel"><h1>{t(title)}</h1><p>{t('cloudSetup')}</p>
      <form className="card form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        {screen !== 'password' && <label>{t('email')}<input type="email" required autoComplete="email" value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label>}
        {screen !== 'reset' && <label>{t(screen === 'password' ? 'newPassword' : 'password')}<input type="password" required minLength={screen === 'login' ? undefined : 12} maxLength={256} autoComplete={screen === 'login' ? 'current-password' : 'new-password'} value={password} disabled={busy} onChange={e => setPassword(e.target.value)}/></label>}
        {screen === 'password' && <label>{t('confirmPassword')}<input type="password" required autoComplete="new-password" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)}/></label>}
        {(screen === 'signup' || screen === 'password') && <small>{t('passwordHint')}</small>}
        <button className="primary" disabled={busy || !cloud}>{t(screen === 'reset' ? 'sendRecovery' : title)}</button>
        {screen === 'login' && <>
          <button type="button" disabled={busy || !cloud} onClick={() => void googleLogin()}>{t('continueGoogle')}</button>
          <button type="button" disabled={busy} onClick={() => navigate('signup')}>{t('createAccount')}</button>
          <button type="button" disabled={busy} onClick={() => navigate('reset')}>{t('forgotPassword')}</button>
        </>}
        {screen !== 'login' && <button type="button" disabled={busy} onClick={() => screen === 'password' ? void logout() : navigate('login')}>{t(screen === 'password' ? 'signOut' : 'backSignIn')}</button>}
        {screen !== 'password' && <button type="button" disabled={busy} onClick={() => navigate('preview')}>{t('localPreview')}</button>}
        <p role="status">{message ? t(message) : ''}</p>
      </form></main>;
  }
  return <><div className="account-bar"><span>{t(screen === 'cloud' ? 'cloudMode' : 'localPreview')}</span>{cloud && <button disabled={busy} onClick={() => screen === 'cloud' ? void logout() : navigate('login')}>{t(screen === 'cloud' ? 'signOut' : 'cloudAccount')}</button>}</div><div key={screen + sessionKey}>{children}</div></>;
}
