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
import { cloudRequest, currentCloudOwner, isCloudActive } from './cloud';
import { canGenerate, readSetting, resolveLocale, saveSetting, type Locale } from './domain';
import Bartender from './screens/Bartender';
import Growth from './screens/Growth';
import Home, { type Decision } from './screens/Home';
import LocalRelationships from './screens/LocalRelationships';
import SettingsScreen from './screens/SettingsScreen';
import { Button, Field, Notice } from './ui';
import { SupportNotices } from './Support';
import { pollDelay, startPolling } from './polling';
import { parseRecoveryList } from './recovery-list';
import { readLocalCheckpoints, removeLocalCheckpoint, saveLocalCheckpoint, validCheckpoint, type EditCheckpoint } from './edit-checkpoint';

type RecoveredEdit = { id: string; text: string; checkin_id: string; base_version: number;
  sync: 'local' | 'saving' | 'saved' | 'failed' | 'deleting' | 'delete_failed' };

export default function App() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>(() => {
    // Set once by the invitation screen so a new member lands on their relationship.
    try {
      const next = sessionStorage.getItem('companion.open-tab');
      sessionStorage.removeItem('companion.open-tab');
      if (next === 'relationships') return 'relationships';
    } catch {
      /* Storage is optional. */
    }
    return 'home';
  });
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ checkins: [], jobs: [] });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [scope, setScope] = useState('');
  const [label, setLabel] = useState('');
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [draft, setDraft] = useState('');
  const [recoveredDrafts, setRecoveredDrafts] = useState<RecoveredEdit[]>([]);
  const [recoveryLoadError, setRecoveryLoadError] = useState(false);
  const [checkpoints, setCheckpoints] = useState<EditCheckpoint[]>([]);
  const [checkpointStatus, setCheckpointStatus] = useState<'local' | 'cloud' | 'failed' | null>(null);
  const [checkpointError, setCheckpointError] = useState(false);
  const [checkpointLoadError, setCheckpointLoadError] = useState(false);
  const [syncedCheckpoints, setSyncedCheckpoints] = useState<Set<string>>(new Set());
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
  const dismissedRecoveries = useRef(new Set<string>());
  const recoveryMutationVersion = useRef(0);
  const checkpointMutationVersion = useRef(0);
  const editingCheckpoint = useRef<EditCheckpoint | null>(null);
  const checkpointTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checkpointMounted = useRef(true);
  const owner = useRef(currentCloudOwner()).current;
  latestDraft.current = draft;
  const language = resolveLocale(i18n.language);
  const cloud = isCloudActive();
  const loadCheckpoints = useCallback(async () => {
    if (!owner) return;
    const version = checkpointMutationVersion.current;
    const result:unknown = await cloudRequest('/active-edit-checkpoint','POST',{action:'list'});
    if (!Array.isArray(result) || !result.every(validCheckpoint)) throw new Error('Checkpoint list unavailable');
    const local = readLocalCheckpoints(owner);
    setCheckpoints(current => {
      const merged = new Map<string,EditCheckpoint>();
      if (version !== checkpointMutationVersion.current) current.forEach(item => merged.set(item.id,item));
      result.forEach(item => merged.set(item.id,item));
      local.forEach(item => {
        const existing=merged.get(item.id);
        if (!existing || item.revision > existing.revision) merged.set(item.id,item);
      });
      return [...merged.values()].filter(item => item.id !== editingCheckpoint.current?.id);
    });
    setCheckpointLoadError(false);
  }, [owner]);
  useEffect(() => {
    if (!cloud || !owner) return;
    setCheckpoints(readLocalCheckpoints(owner));
    return startPolling(loadCheckpoints, {delay: failures => pollDelay(true, false, failures),
      onError: () => setCheckpointLoadError(true)});
  }, [cloud, owner, loadCheckpoints]);
  useEffect(() => {
    checkpointMounted.current=true;
    return () => { checkpointMounted.current=false; clearTimeout(checkpointTimer.current); };
  }, []);

  async function syncCheckpoint(item:EditCheckpoint) {
    if (!owner || currentCloudOwner()!==owner || !checkpointMounted.current) return;
    try {
      const result=await cloudRequest('/active-edit-checkpoint','POST',{action:'save',args:item});
      if (result.id!==item.id || result.revision!==item.revision) throw new Error('Checkpoint acknowledgement unavailable');
      if (editingCheckpoint.current?.id===item.id && editingCheckpoint.current.revision===item.revision) setCheckpointStatus('cloud');
    } catch {
      if (editingCheckpoint.current?.id===item.id && editingCheckpoint.current.revision===item.revision) {
        setCheckpointStatus(owner && saveLocalCheckpoint(owner,item) ? 'local' : 'failed');
        if (checkpointMounted.current && currentCloudOwner()===owner) {
          clearTimeout(checkpointTimer.current);
          checkpointTimer.current=setTimeout(() => void syncCheckpoint(item),15000);
        }
      }
    }
  }
  function changeDraft(text:string) {
    setDraft(text);
    if (!cloud || !owner || !active) return;
    const previous=editingCheckpoint.current;
    const item:EditCheckpoint = previous && previous.checkin_id===active.id && previous.base_version===active.version
      ? {...previous,revision:previous.revision+1,text}
      : {id:crypto.randomUUID(),checkin_id:active.id,base_version:active.version,revision:1,text};
    editingCheckpoint.current=item;
    ++checkpointMutationVersion.current;
    setCheckpointStatus(saveLocalCheckpoint(owner,item) ? 'local' : 'failed');
    clearTimeout(checkpointTimer.current);
    checkpointTimer.current=setTimeout(() => void syncCheckpoint(item),2000);
  }
  async function dismissCheckpoint(item:EditCheckpoint) {
    if (!owner) return;
    ++checkpointMutationVersion.current;
    try {
      const result=await cloudRequest('/active-edit-checkpoint','POST',{action:'dismiss',args:{id:item.id,checkin_id:item.checkin_id,base_version:item.base_version}});
      if (result.dismissed!==true || !removeLocalCheckpoint(owner,item.id)) throw new Error('Dismissal unavailable');
      ++checkpointMutationVersion.current;
      setCheckpoints(items => items.filter(row => row.id!==item.id));
      setCheckpointError(false);
    } catch { setCheckpointError(true); }
  }
  async function retryCheckpoint(item:EditCheckpoint) {
    try {
      const result=await cloudRequest('/active-edit-checkpoint','POST',{action:'save',args:item});
      if (result.id!==item.id || result.revision!==item.revision) throw new Error('Checkpoint acknowledgement unavailable');
      setSyncedCheckpoints(ids => new Set(ids).add(item.id));
      setCheckpointError(false);
    } catch { setCheckpointError(true); }
  }
  function removeDeviceCheckpoint(item:EditCheckpoint) {
    if (!owner || !removeLocalCheckpoint(owner,item.id)) { setCheckpointError(true); return; }
    ++checkpointMutationVersion.current;
    setCheckpoints(items => items.filter(row => row.id!==item.id));
    setCheckpointError(false);
  }
  const loadRecoveries = useCallback(async () => {
    const version = recoveryMutationVersion.current;
    try {
      const rows = parseRecoveryList(await cloudRequest('/edit-recovery','POST',{action:'list'}));
      setRecoveredDrafts(current => {
        const present = new Set(rows.map(item => item.id));
        // A list started before a local mutation cannot remove a newly saved edit.
        const retained = version === recoveryMutationVersion.current
          ? current.filter(item => item.sync !== 'saved' || present.has(item.id)) : current;
        const known = new Set(retained.map(item => item.id));
        return [...retained, ...rows.filter(item => !known.has(item.id) && !dismissedRecoveries.current.has(item.id))
          .map(item => ({...item, sync:'saved' as const}))];
      });
      setRecoveryLoadError(false);
    } catch { setRecoveryLoadError(true); throw new Error('Recovery list unavailable'); }
  }, []);
  useEffect(() => {
    if (!cloud) return;
    return startPolling(loadRecoveries, {delay: failures => pollDelay(true, false, failures)});
  }, [cloud, loadRecoveries]);

  async function saveRecovery(item: RecoveredEdit) {
    ++recoveryMutationVersion.current;
    setRecoveredDrafts(items => items.map(row => row.id === item.id ? {...row,sync:'saving'} : row));
    try {
      const result = await cloudRequest('/edit-recovery','POST',{action:'save',args:{id:item.id,checkin_id:item.checkin_id,
        base_version:item.base_version,text:item.text}});
      if (result.id !== item.id) throw new Error('Save acknowledgement unavailable');
      ++recoveryMutationVersion.current;
      setRecoveredDrafts(items => items.map(row => row.id === item.id && row.sync === 'saving' ? {...row,sync:'saved'} : row));
    } catch {
      ++recoveryMutationVersion.current;
      setRecoveredDrafts(items => items.map(row => row.id === item.id && row.sync === 'saving' ? {...row,sync:'failed'} : row));
    }
  }
  async function dismissRecovery(item: RecoveredEdit) {
    if (item.sync === 'local') { setRecoveredDrafts(items => items.filter(row => row.id !== item.id)); return; }
    ++recoveryMutationVersion.current;
    setRecoveredDrafts(items => items.map(row => row.id === item.id ? {...row,sync:'deleting'} : row));
    try {
      const result = await cloudRequest('/edit-recovery','POST',{action:'dismiss',args:{id:item.id,checkin_id:item.checkin_id,base_version:item.base_version}});
      if (result.dismissed !== true) throw new Error('Dismissal unavailable');
      ++recoveryMutationVersion.current;
      dismissedRecoveries.current.add(item.id);
      setRecoveredDrafts(items => items.filter(row => row.id !== item.id));
    } catch {
      ++recoveryMutationVersion.current;
      setRecoveredDrafts(items => items.map(row => row.id === item.id ? {...row,sync:'delete_failed'} : row));
    }
  }
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
      const item:RecoveredEdit = {id:crypto.randomUUID(),text,checkin_id:previous.id,
        base_version:previous.version,sync:cloud?'saving':'local'};
      setRecoveredDrafts(items => [...items, item]);
      if (cloud) void saveRecovery(item);
    }
    approvedHere.current = null;
    clearTimeout(checkpointTimer.current);
    if (editingCheckpoint.current) {
      const item=editingCheckpoint.current;
      setCheckpoints(items => [...items.filter(row => row.id!==item.id),item]);
      void syncCheckpoint(item);
    }
    editingCheckpoint.current=null;
    setCheckpointStatus(null);
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
      {recoveryLoadError && <Notice tone="warning" actions={<Button onClick={() => void loadRecoveries().catch(() => undefined)}>{t('recoveryRefresh')}</Button>}>
        <p>{t('recoveryLoadFailed')}</p></Notice>}
      {checkpointLoadError && <Notice tone="warning" actions={<Button onClick={() => void loadCheckpoints().catch(() => setCheckpointLoadError(true))}>{t('recoveryRefresh')}</Button>}>
        <p>{t('checkpointLoadFailed')}</p></Notice>}
      {checkpointError && <Notice tone="warning"><p role="status">{t('checkpointActionFailed')}</p></Notice>}
      {checkpoints.map((item,index) => <Notice key={item.id} tone="warning">
        <Field label={t('checkpointRecovered')} hint={t(syncedCheckpoints.has(item.id) ? 'checkpointCloud' : 'checkpointRecoveredHint')}>
          <textarea readOnly value={item.text} rows={4} dir="auto" />
        </Field>
        {active?.id===item.checkin_id && active.version===item.base_version && draft===active.draft &&
          <Button onClick={() => changeDraft(item.text)} aria-label={`${t('checkpointRestore')} ${index+1}`}>
            {t('checkpointRestore')}
          </Button>}
        <Button onClick={() => void retryCheckpoint(item)} aria-label={`${t('checkpointRetry')} ${index+1}`}>
          {t('checkpointRetry')}
        </Button>
        <Button onClick={() => removeDeviceCheckpoint(item)} aria-label={`${t('checkpointRemoveDevice')} ${index+1}`}>
          {t('checkpointRemoveDevice')}
        </Button>
        <Button onClick={() => void dismissCheckpoint(item)} aria-label={`${t('checkpointDismiss')} ${index+1}`}>
          {t('checkpointDismiss')}
        </Button>
      </Notice>)}
      {recoveredDrafts.map((item, index) => (
        <Notice key={item.id} tone="warning">
          <Field label={t('recoveredDraftLabel')} hint={t(item.sync === 'saved' ? 'recoverySaved' : 'recoveredDraftHint')}>
            <textarea readOnly value={item.text} rows={4} dir="auto" />
          </Field>
          {item.sync === 'saving' && <p role="status">{t('recoverySaving')}</p>}
          {(item.sync === 'failed' || item.sync === 'delete_failed') && <p role="status">{t(item.sync === 'failed' ? 'recoveryFailed' : 'recoveryDeleteFailed')}</p>}
          {item.sync === 'failed' && <Button onClick={() => void saveRecovery(item)}>{t('recoveryRetry')}</Button>}
          <Button disabled={item.sync === 'deleting'} onClick={() => void dismissRecovery(item)}
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
          onDraft={changeDraft}
          checkpointStatus={checkpointStatus}
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
