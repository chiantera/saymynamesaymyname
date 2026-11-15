import Scheduling from './Scheduling';
import Sharing from './Sharing';
import {isCloudActive} from './cloud';
import Relationships, {JoinInvitation} from './Relationships';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError, type Entry, type Preferences, type Relationship, type Snapshot } from './api';
import { canGenerate, localeNames, locales, readSetting, resolveLocale, saveSetting, type Locale } from './domain';

type Tab = 'home' | 'relationships' | 'growth' | 'bartender' | 'settings';
const tabs: Tab[] = ['home', 'relationships', 'growth', 'bartender', 'settings'];
const symbols: Record<Tab, string> = { home: '⌂', relationships: '◎', growth: '↗', bartender: '◒', settings: '⚙' };

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'errorMessage' | 'errorConflict' | null>(null);
  const [notice, setNotice] = useState(false);
  const [theme, setTheme] = useState(readSetting('theme') ?? 'system');
  const refreshSequence = useRef(0);
  const active = snapshot.checkins.find(c => c.status === 'pending');
  const queued = snapshot.jobs.some(j => j.status === 'queued' || j.status === 'processing');
  const language = resolveLocale(i18n.language);
  const number = (value: number) => new Intl.NumberFormat(language).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: prefs?.timezone ?? 'Europe/Berlin' }).format(new Date(value));

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const [state, saved] = await Promise.all([api.snapshot(), api.entries()]);
    if (sequence === refreshSequence.current) { setSnapshot(state); setEntries(saved); }
  }, []);
  const connect = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      await api.connect();
      let settings = await api.preferences();
      const preferred = resolveLocale(readSetting('locale') ?? i18n.language);
      if (!isCloudActive() && settings.locale !== preferred) settings = await api.savePreferences(preferred, settings.timezone);
      setPrefs(settings); setTimezone(settings.timezone);
      await i18n.changeLanguage(settings.locale);
      setRelationships(await api.relationships()); await refresh();
    } catch { setError('errorMessage'); } finally { setBusy(false); }
  }, [i18n, refresh]);
  useEffect(() => { void connect(); }, [connect]);
  useEffect(() => {
    if (!prefs) return;
    let stopped = false;
    const timer = setInterval(() => {
      if (!stopped) void refresh().catch(() => { if (!stopped) setError('errorMessage'); });
    }, 1500);
    return () => { stopped = true; clearInterval(timer); };
  }, [prefs, refresh]);
  useEffect(() => { setDraft(active?.draft ?? ''); }, [active?.id, active?.version]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('appTitle');
  }, [language, t]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveSetting('theme', theme);
  }, [theme]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setError(null); setNotice(false);
    try { await action(); await refresh(); return true; }
    catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'errorConflict' : 'errorMessage');
      await refresh().catch(() => undefined); return false;
    } finally { setBusy(false); }
  }
  async function selectLanguage(locale: Locale) {
    if (prefs) {
      if (!await perform(async () => { setPrefs(await api.savePreferences(locale, prefs.timezone)); })) return;
    }
    saveSetting('locale', locale); await i18n.changeLanguage(locale);
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#main" onClick={() => setTab('home')}><span className="brand-mark" aria-hidden="true">◒</span><span>{t('appTitle')}<small>{t('tagline')}</small></span></a>
      <label className="language-picker"><span className="sr-only">{t('language')}</span><select value={language} disabled={busy} onChange={e => void selectLanguage(e.target.value as Locale)}>{locales.map(l => <option key={l} value={l}>{localeNames[l]}</option>)}</select></label>
    </header>
    <nav className="navigation" aria-label={t('appTitle')}>
      {tabs.map(item => <button key={item} className={tab === item ? 'nav-item selected' : 'nav-item'} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}><span aria-hidden="true">{symbols[item]}</span><span>{t(item)}</span></button>)}
      <p className="nav-note">{t('contextOff')}</p>
    </nav>
    <main id="main" tabIndex={-1}>
      <aside className="demo-notice"><strong>{t(isCloudActive()?'cloudAccount':'demoBadge')}</strong><p>{t(isCloudActive()?'cloudMode':'demoNotice')}</p><small>{t('translationNotice')}</small></aside>
      <JoinInvitation onJoined={() => setTab('relationships')}/>
      {error && <div className="error" role="alert"><p>{t(error)}</p><button onClick={() => void connect()} disabled={busy}>{t('retry')}</button></div>}
      {tab === 'home' && <>
        <section className="hero"><span className="eyebrow">{t('today')}</span><h1>{t('welcome')}</h1><p>{t('lead')}</p><div className="generate-controls">
          <label><span className="sr-only">{t('relationships')}</span><select disabled={isCloudActive()} value={scope} onChange={e => setScope(e.target.value)}><option value="">{t('solo')}</option>{relationships.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
          <button className="primary" disabled={!prefs || busy || !canGenerate(snapshot.checkins.map(c => c.status), snapshot.jobs.map(j => j.status))} onClick={() => void perform(() => api.generate(scope || null))}>{t('generate')} <span aria-hidden="true">↗</span></button>
        </div></section>
        <div className="content-grid"><section className="card inbox"><div className="section-heading"><h2>{t('checkinTitle')}</h2><span className="pill">{t('privateLabel')}</span></div>
          {queued && <p className="processing" role="status">{t('working')}</p>}
          {!queued && snapshot.checkins.length === 0 && <p className="empty-state">{t('emptyCheckins')}</p>}
          {active && <article className="draft-card"><span className="status">{t('pending')}</span><h3>{active.prompt}</h3><p>{t('review')}</p><label><span className="sr-only">{t('review')}</span><textarea value={draft} maxLength={5000} rows={5} onChange={e => setDraft(e.target.value)} /></label><div className="actions"><button className="primary" disabled={busy || !draft.trim()} onClick={() => void perform(() => api.decide(active, 'approve', draft))}>{t('approve')}</button><button disabled={busy} onClick={() => void perform(() => api.decide(active, 'skip'))}>{t('skip')}</button><button disabled={busy} onClick={() => void perform(() => api.decide(active, 'snooze'))}>{t('snooze')}</button></div><small>{t('decisionWindow')}</small></article>}
          {snapshot.checkins.filter(c => c.status !== 'pending').slice(0, 4).map(c => <div className="history-item" key={c.id}><span className={`dot ${c.status}`} /><span>{t(c.status)}{c.snoozed_until && <small>{date(c.snoozed_until)}</small>}</span></div>)}
        </section><aside className="side-cards"><section className="card small-card"><span className="eyebrow">{t('budget')}</span><strong className="big-number">{new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(0)}</strong><p>{t('zeroCost')}</p></section><section className="card small-card"><span className="eyebrow">{t('quietHours')}</span><strong className="hours">22:00–08:00</strong><p>{prefs?.timezone ?? timezone}</p></section></aside></div>
        <section className="card reflections"><h2>{t('entries')}</h2>{entries.length === 0 ? <p className="empty-state">{t('emptyEntries')}</p> : entries.map(e => <article className="entry" key={e.id}><time dateTime={e.created_at}>{date(e.created_at)}</time><p>{e.text}</p><span className="pill">{t('privateLabel')}</span></article>)}</section>
      </>}
      {tab === 'settings' && isCloudActive() && <Scheduling/>}
      {tab === 'home' && isCloudActive() && <Sharing entries={entries}/>}
      {tab === 'relationships' && (isCloudActive() ? <Relationships/> : <section className="page-panel"><span className="eyebrow">{t('relationships')}</span><h1>{t('emptyRelationships')}</h1><p>{t('relationshipScope')}</p><form className="card form" onSubmit={e => { e.preventDefault(); void perform(async () => { await api.addRelationship(label); setLabel(''); setRelationships(await api.relationships()); }); }}><label>{t('relationshipLabel')}<input value={label} required maxLength={80} onChange={e => setLabel(e.target.value)} /></label><button className="primary" disabled={busy || !prefs || !label.trim()}>{t('addRelationship')}</button></form>{relationships.map(r => <article className="card relationship-card" key={r.id}><h2>{r.label}</h2><span className="pill">{t('privateLabel')}</span></article>)}</section>)}
      {(tab === 'growth' || tab === 'bartender') && <section className="page-panel"><span className="eyebrow">{t('upcoming')}</span><h1>{t(tab)}</h1><p>{t('notReady')}</p><button className="primary" onClick={() => setTab('home')}>{t('home')}</button></section>}
      {tab === 'settings' && <section className="page-panel"><span className="eyebrow">{t('settings')}</span><h1>{t('preferences')}</h1><form className="card form" onSubmit={e => { e.preventDefault(); void perform(async () => { setPrefs(await api.savePreferences(language, timezone)); setNotice(true); }); }}><label>{t('timezone')}<input value={timezone} maxLength={80} required onChange={e => setTimezone(e.target.value)} /></label><button className="primary" disabled={!prefs || busy}>{t('save')}</button>{notice && <span role="status">{t('saved')}</span>}</form><div className="card form"><label>{t('theme')}<select value={theme} onChange={e => setTheme(e.target.value)}>{['system', 'light', 'dark'].map(v => <option value={v} key={v}>{t(v)}</option>)}</select></label><dl><dt>{t('cadence')}</dt><dd>{new Intl.NumberFormat(language, { style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(prefs?.cadence_hours ?? 6)}</dd><dt>{t('nudgeCap')}</dt><dd>{number(prefs?.daily_nudge_cap ?? 3)}</dd><dt>{t('quietHours')}</dt><dd>22:00–08:00</dd></dl><p>{t('contextOff')}</p><small>{t(isCloudActive()?'cloudMode':'demoNotice')}</small></div></section>}
    </main>
  </div>;
}
