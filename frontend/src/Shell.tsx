/*
 * Application frame. Renders the rail (720px and wider) or the header plus bottom
 * tab bar (narrower). Exactly one layout is mounted, so the language picker, the
 * account control and each destination button exist once at any width.
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { House, LogIn, LogOut, Martini, Settings, Sprout, Waypoints } from 'lucide-react';
import { useAccount } from './AuthGate';
import { localeNames, locales, type Locale } from './domain';
import { Button, Field, Icon, type LucideIcon } from './ui';

export const tabs = ['home', 'relationships', 'growth', 'bartender', 'settings'] as const;
export type Tab = (typeof tabs)[number];

const tabIcons: Record<Tab, LucideIcon> = {
  home: House,
  relationships: Waypoints,
  growth: Sprout,
  bartender: Martini,
  settings: Settings,
};

const compactQuery = '(max-width: 719.98px)';

function subscribeCompact(notify: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

function useCompactLayout() {
  return useSyncExternalStore(subscribeCompact, () => window.matchMedia(compactQuery).matches);
}

export interface ShellProps {
  /** The selected destination. */
  tab: Tab;
  onTab: (tab: Tab) => void;
  /** The resolved interface language. */
  language: Locale;
  onLanguage: (locale: Locale) => void;
  /** Disables the language picker while a request is in flight. */
  busy: boolean;
  /** True when a private cloud session is active; false in the fictional preview. */
  cloud: boolean;
  children: ReactNode;
}

export default function Shell({ tab, onTab, language, onLanguage, busy, cloud, children }: ShellProps) {
  const { t } = useTranslation();
  const account = useAccount();
  const compact = useCompactLayout();

  const brand = (
    <a className="shell-brand" href="#main" onClick={() => onTab('home')}>
      <span className="brand-mark" aria-hidden="true">
        ◒
      </span>
      <span className="shell-brand__text">
        <span className="shell-brand__title">{t('appTitle')}</span>
        {!compact && <span className="shell-brand__tagline">{t('tagline')}</span>}
      </span>
    </a>
  );

  const navigation = (
    <nav className={compact ? 'shell-nav shell-nav--tabs' : 'shell-nav'} aria-label={t('appTitle')}>
      {tabs.map((item) => (
        <button
          key={item}
          type="button"
          className="shell-nav__item"
          aria-current={tab === item ? 'page' : undefined}
          onClick={() => onTab(item)}
        >
          <Icon icon={tabIcons[item]} size={compact ? 22 : 20} />
          <span className="shell-nav__label">{t(item)}</span>
        </button>
      ))}
    </nav>
  );

  const languagePicker = (
    <Field label={t('language')} hideLabel className="shell-language">
      <select
        value={language}
        disabled={busy}
        onChange={(event) => onLanguage(event.target.value as Locale)}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </Field>
  );

  // Sign out (cloud) or open sign-in (preview). Hidden when no cloud project is configured.
  const accountControl = account?.available && (
    <Button
      className="shell-account"
      size="sm"
      icon={account.mode === 'cloud' ? LogOut : LogIn}
      disabled={account.busy}
      onClick={account.act}
    >
      {t(account.mode === 'cloud' ? 'signOut' : 'cloudAccount')}
    </Button>
  );

  // Who is using the app right now: the signed-in email, or the fictional preview.
  const email = account?.email ?? null;
  const identity = (
    <div className="shell-who">
      <span className="shell-who__avatar" aria-hidden="true">
        {email ? email.slice(0, 1).toLocaleUpperCase(language) : '?'}
      </span>
      <span className="shell-who__text">
        <span className="shell-who__label">{t(email ? 'signedInAs' : 'notSignedIn')}</span>
        <span className="shell-who__name" title={email ?? undefined}>
          {email ?? t('demoBadge')}
        </span>
      </span>
    </div>
  );

  const modeNotice = (
    <div className="shell-mode">
      <p className="shell-mode__description">{t(cloud ? 'cloudMode' : 'demoNotice')}</p>
      <p>{t('contextOff')}</p>
      <p>{t('translationNotice')}</p>
    </div>
  );

  const main = (
    <main id="main" className="shell-main" tabIndex={-1} key="main">
      {compact && (
        <div className="shell-intro">
          {identity}
          {modeNotice}
        </div>
      )}
      <div className="shell-content" key="content">
        {children}
      </div>
    </main>
  );

  if (compact) {
    return (
      <div className="app-shell app-shell--tabs">
        <header className="shell-header" key="frame">
          {brand}
          {languagePicker}
          {accountControl}
        </header>
        {/* Fixed to the bottom by CSS; kept before main so focus moves from the tabs into the content. */}
        {navigation}
        {main}
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--rail">
      <header className="shell-rail" key="frame">
        {brand}
        {navigation}
        <div className="shell-rail__foot">
          <div className="shell-account-block">
            {identity}
            {accountControl}
          </div>
          {modeNotice}
          {languagePicker}
        </div>
      </header>
      {main}
    </div>
  );
}
