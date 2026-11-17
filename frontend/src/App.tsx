/*
 * Owns data loading, polling, the guarded `perform` wrapper, language and theme
 * effects, and routing between the five destinations. All markup lives in
 * Shell.tsx and screens/. Keep request sequencing and guards here unchanged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import AIConsent from './AIConsent';
import Budget from './Budget';
import Relationships, { JoinInvitation } from './Relationships';
import Scheduling from './Scheduling';
import Sharing from './Sharing';
import Shell, { type Tab } from './Shell';
import {
  api,
  ApiError,
  type Checkin,
  type Entry,
  type Preferences,
  type Relationship,
  type Snapshot,
} from './api';
import { isCloudActive } from './cloud';
import { canGenerate, readSetting, resolveLocale, saveSetting, type Locale } from './domain';
import Bartender from './screens/Bartender';
import Growth from './screens/Growth';
import Home, { type Decision } from './screens/Home';
import LocalRelationships from './screens/LocalRelationships';
import SettingsScreen from './screens/SettingsScreen';
import { Button, Field, Notice } from './ui';
import { SupportNotices } from './Support';
import { pollDelay, startPolling } from './polling';

export default function App() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('home');
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ checkins: [], jobs: [] });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [scope, setScope] = useState('');
  const [label, setLabel] = useState('');
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [draft, setDraft] = useState('');
  const [recoveredDrafts, setRecoveredDrafts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'errorMessage' | 'errorConflict' | null>(null);
  const [notice, setNotice] = useState(false);
  const [theme, setTheme] = useState(readSetting('theme') ?? 'system');
  const refreshSequence = useRef(0);
  const lastTab = useRef(tab);
  const pollSnapshot = useRef(snapshot);
  pollSnapshot.current = snapshot;
  const ready = prefs !== null;
  const active = snapshot.checkins.find((checkin) => checkin.status === 'pending');
  const previousActive = useRef<Checkin | undefined>(undefined);
  const latestDraft = useRef(draft);
  const approvedHere = useRef<string | null>(null);
  latestDraft.current = draft;
  const language = resolveLocale(i18n.language);
  const cloud = isCloudActive();
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: prefs?.timezone ?? 'Europe/Berlin',
    }).format(new Date(value));

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const { snapshot: state, entries: saved } = await api.refresh();
    // A slower, older response must never replace a newer one.
    if (sequence === refreshSequence.current) {
      pollSnapshot.current = state;
      setSnapshot(state);
      setEntries(saved);
    }
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api.connect();
      let settings = await api.preferences();
      const preferred = resolveLocale(readSetting('locale') ?? i18n.language);
      if (!isCloudActive() && settings.locale !== preferred) {
        settings = await api.savePreferences(preferred, settings.timezone);
      }
      setPrefs(settings);
      setTimezone(settings.timezone);
      await i18n.changeLanguage(settings.locale);
      setRelationships(await api.relationships());
      await refresh();
    } catch {
      setError('errorMessage');
    } finally {
      setBusy(false);
    }
  }, [i18n, refresh]);

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    if (lastTab.current === tab) return;
    lastTab.current = tab;
    if (tab === 'home' && ready && cloud) void refresh().catch(() => setError('errorMessage'));
  }, [tab, ready, cloud, refresh]);

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    const stop = startPolling(refresh, {
      immediate: false,
      delay: failures => pollDelay(cloud,
        pollSnapshot.current.jobs.some(job => ['queued','processing'].includes(job.status)), failures),
      onError: () => { if (!stopped) setError('errorMessage'); },
    });
    return () => {
      stopped = true;
      stop();
    };
  }, [ready, cloud, refresh]);

  useEffect(() => {
    const previous = previousActive.current;
    if (previous && approvedHere.current !== previous.id && latestDraft.current !== previous.draft) {
      const text = latestDraft.current;
      setRecoveredDrafts(items => [...items, text]);
    }
    approvedHere.current = null;
    previousActive.current = active;
    setDraft(active?.draft ?? '');
  }, [active?.id, active?.version]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('appTitle');
  }, [language, t]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveSetting('theme', theme);
    const updateChrome = () => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
        meta.setAttribute('content', color);
      }
    };
    updateChrome();
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', updateChrome);
    return () => scheme.removeEventListener('change', updateChrome);
  }, [theme]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setNotice(false);
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'errorConflict' : 'errorMessage');
      await refresh().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function selectLanguage(locale: Locale) {
    if (prefs) {
      const saved = await perform(async () => {
        setPrefs(await api.savePreferences(locale, prefs.timezone));
      });
      if (!saved) return;
    }
    saveSetting('locale', locale);
    await i18n.changeLanguage(locale);
  }

  function decide(checkin: Checkin, decision: Decision) {
    // Only approval carries text; the check-in version guards against stale decisions.
    void perform(async () => {
      const result = await (decision === 'approve' ? api.decide(checkin, 'approve', draft) : api.decide(checkin, decision));
      if (decision === 'approve') approvedHere.current = checkin.id;
      return result;
    });
  }

  function addRelationship() {
    void perform(async () => {
      await api.addRelationship(label);
      setLabel('');
      setRelationships(await api.relationships());
    });
  }

  function savePreferences() {
    void perform(async () => {
      setPrefs(await api.savePreferences(language, timezone));
      setNotice(true);
    });
  }

  return (
    <Shell
      tab={tab}
      onTab={setTab}
      language={language}
      onLanguage={(locale) => void selectLanguage(locale)}
      busy={busy}
      cloud={cloud}
    >
      <JoinInvitation onJoined={() => setTab('relationships')} />
      {cloud && <SupportNotices />}
      {recoveredDrafts.map((text, index) => (
        <Notice key={index} tone="warning">
          <Field label={t('recoveredDraftLabel')} hint={t('recoveredDraftHint')}>
            <textarea readOnly value={text} rows={4} dir="auto" />
          </Field>
          <Button onClick={() => setRecoveredDrafts(items => items.filter((_, i) => i !== index))}
            aria-label={`${t('recoveredDraftDismiss')} ${index + 1}`}>
            {t('recoveredDraftDismiss')}
          </Button>
        </Notice>
      ))}
      {error && (
        <Notice
          tone="error"
          role="alert"
          icon={TriangleAlert}
          actions={
            <Button size="sm" disabled={busy} onClick={() => void connect()}>
              {t('retry')}
            </Button>
          }
        >
          <p>{t(error)}</p>
        </Notice>
      )}
      {tab === 'home' && (
        <Home
          cloud={cloud}
          busy={busy}
          canGenerate={
            prefs !== null &&
            !busy &&
            canGenerate(
              snapshot.checkins.map((checkin) => checkin.status),
              snapshot.jobs.map((job) => job.status),
            )
          }
          language={language}
          preferences={prefs}
          timezone={prefs?.timezone ?? timezone}
          snapshot={snapshot}
          entries={entries}
          relationships={relationships}
          scope={scope}
          onScope={setScope}
          draft={draft}
          onDraft={setDraft}
          onGenerate={() => void perform(() => api.generate(scope || null))}
          onDecide={decide}
          formatDate={formatDate}
        >
          {cloud && <Sharing entries={entries} />}
        </Home>
      )}
      {tab === 'relationships' &&
        (cloud ? (
          <Relationships />
        ) : (
          <LocalRelationships
            busy={busy}
            ready={prefs !== null}
            relationships={relationships}
            label={label}
            onLabel={setLabel}
            onAdd={addRelationship}
          />
        ))}
      {tab === 'growth' && <Growth onHome={() => setTab('home')} />}
      {tab === 'bartender' && <Bartender onHome={() => setTab('home')} />}
      {tab === 'settings' && (
        <SettingsScreen
          cloud={cloud}
          busy={busy}
          language={language}
          preferences={prefs}
          timezone={timezone}
          onTimezone={setTimezone}
          onSave={savePreferences}
          saved={notice}
          theme={theme}
          onTheme={setTheme}
        >
          {cloud && <Scheduling />}
          {cloud && <AIConsent entries={entries} />}
          {cloud && <Budget />}
        </SettingsScreen>
      )}
    </Shell>
  );
}
