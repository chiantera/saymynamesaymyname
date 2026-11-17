/*
 * Cloud check-in schedule (cloud mode only).
 *
 * Off by default. A schedule is per scope (just me, or one relationship); quiet
 * hours, the daily limit and pause-all apply to every scope. Saving sends the
 * loaded revision back so a stale form is rejected by the server. The jobs list
 * shows the durable queue; queueing uses the scope selected in the form.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListPlus, RefreshCw, TriangleAlert } from 'lucide-react';
import { cloudRequest } from './cloud';
import { membership, type Workspace } from './membership-api';
import { Button, Check, Chip, EmptyState, Field, Notice, Section } from './ui';

type ScopeConfig = { scope: string; enabled: boolean; cadence_hours: number };

type Config = {
  revision: number;
  paused: boolean;
  paused_until: string | null;
  quiet_start: string;
  quiet_end: string;
  daily_cap: number;
  scopes: ScopeConfig[];
};

type Job = { id: string; status: string };

const request = (path: string, action: string, args: Record<string, unknown> = {}) =>
  cloudRequest('/cloud/' + path, 'POST', { action, args });

const activeStatuses = ['queued', 'processing'];

/** Catalog key for a job status. */
function statusKey(status: string): string {
  if (status === 'done') return 'draftReady';
  if (status === 'processing') return 'working';
  return status;
}

/** Chip tone for a job status: lamp while it waits, action once a draft exists. */
function statusTone(status: string): 'neutral' | 'action' | 'lamp' | 'danger' {
  if (activeStatuses.includes(status)) return 'lamp';
  if (status === 'done') return 'action';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export default function Scheduling() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Config | null>(null);
  const [spaces, setSpaces] = useState<Workspace>({ relationships: [], blocks: [] });
  const [scope, setScope] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [cadence, setCadence] = useState(6);
  const [ready, setReady] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function refresh() {
    setBusy(true);
    setError(false);
    try {
      const [loadedConfig, workspace, status, queue] = await Promise.all([
        request('schedule', 'get'),
        membership.workspace(),
        request('status', 'get'),
        request('queue', 'list'),
      ]);
      setConfig(loadedConfig);
      setSpaces(workspace);
      setReady(status.ready);
      setJobs(queue);
      const selected = loadedConfig.scopes.find((item: ScopeConfig) => item.scope === scope);
      setEnabled(selected?.enabled ?? false);
      setCadence(selected?.cadence_hours ?? 6);
    } catch {
      setError(true);
      setReady(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function act(operation: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      await operation();
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function selectScope(value: string, current: Config) {
    setScope(value);
    const selected = current.scopes.find((item) => item.scope === value);
    setEnabled(selected?.enabled ?? false);
    setCadence(selected?.cadence_hours ?? 6);
  }

  // Before the first answer arrives the service is neither ready nor unavailable.
  const checking = config === null && !error;

  return (
    <Section
      className="settings-schedule"
      ariaLabel={t('scheduleTitle')}
      title={t('scheduleTitle')}
      actions={
        <Button size="sm" icon={RefreshCw} disabled={busy} onClick={() => void refresh()}>
          {t('sharingRefresh')}
        </Button>
      }
    >
      <p
        className="settings-schedule__status"
        role="status"
        data-state={checking ? 'checking' : ready ? 'ready' : 'unavailable'}
      >
        <span className="settings-schedule__dot" aria-hidden="true" />
        <span>{t(checking ? 'scheduleChecking' : ready ? 'workerReady' : 'workerUnavailable')}</span>
      </p>

      <Notice>{t('scheduleNotice')}</Notice>

      {error && (
        <Notice tone="error" role="alert" icon={TriangleAlert}>
          {t('sharingError')}
        </Notice>
      )}

      {config && (
        <form
          className="settings-form"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void act(() =>
              request('schedule', 'save', { ...config, scope, enabled, cadence_hours: cadence }),
            );
          }}
        >
          <fieldset className="settings-group">
            <legend className="settings-group__title">{t('scheduleGroupScope')}</legend>
            <Field
              label={t('relationships')}
              hint={t('scheduleScopeHint')}
              className="settings-narrow"
            >
              <select
                value={scope}
                disabled={busy}
                onChange={(event) => selectScope(event.target.value, config)}
              >
                <option value="">{t('solo')}</option>
                {spaces.relationships
                  .filter((space) => !space.mine.archived && !space.mine.muted)
                  .map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Check
              label={t('scheduleEnabled')}
              checked={enabled}
              disabled={busy}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <Field
              label={t('cadence')}
              hint={t('scheduleCadenceHint')}
              className="settings-narrow settings-narrow--number"
            >
              <input
                type="number"
                inputMode="numeric"
                min={3}
                max={12}
                required
                value={cadence}
                disabled={busy}
                onChange={(event) => setCadence(Number(event.target.value))}
              />
            </Field>
          </fieldset>

          <fieldset className="settings-group">
            <legend className="settings-group__title">{t('scheduleGroupAll')}</legend>
            <fieldset className="field">
              <legend className="field__label">{t('quietHours')}</legend>
              <div className="settings-range">
                <input
                  aria-label={t('quietStart')}
                  type="time"
                  required
                  value={config.quiet_start}
                  disabled={busy}
                  onChange={(event) => setConfig({ ...config, quiet_start: event.target.value })}
                />
                <span aria-hidden="true">–</span>
                <input
                  aria-label={t('quietEnd')}
                  type="time"
                  required
                  value={config.quiet_end}
                  disabled={busy}
                  onChange={(event) => setConfig({ ...config, quiet_end: event.target.value })}
                />
              </div>
              <p className="field__hint">{t('scheduleQuietHint')}</p>
            </fieldset>
            <Field label={t('nudgeCap')} className="settings-narrow settings-narrow--number">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                required
                value={config.daily_cap}
                disabled={busy}
                onChange={(event) => setConfig({ ...config, daily_cap: Number(event.target.value) })}
              />
            </Field>
            <Check
              label={t('schedulePaused')}
              hint={t('schedulePausedHint')}
              checked={config.paused}
              disabled={busy}
              onChange={(event) => setConfig({ ...config, paused: event.target.checked })}
            />
          </fieldset>

          <div className="cluster">
            <Button type="submit" variant="primary" disabled={busy}>
              {t('save')}
            </Button>
          </div>
        </form>
      )}

      <div className="settings-jobs">
        <div className="settings-jobs__head">
          <h3>{t('cloudJobs')}</h3>
          <Button
            size="sm"
            icon={ListPlus}
            disabled={busy || !ready}
            onClick={() =>
              void act(() =>
                request('queue', 'enqueue', {
                  request_id: crypto.randomUUID(),
                  relationship_id: scope || null,
                }),
              )
            }
          >
            {t('queueCheckin')}
          </Button>
        </div>
        <p className="muted text-sm">{t('scheduleQueueHint')}</p>
        {jobs.length > 0 ? (
          <ul className="rows settings-jobs__list">
            {jobs.map((job) => (
              <li className="settings-jobs__item" key={job.id}>
                <Chip tone={statusTone(job.status)}>{t(statusKey(job.status))}</Chip>
                {activeStatuses.includes(job.status) && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void act(() => request('queue', 'cancel', { id: job.id }))}
                  >
                    {t('cancelAction')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          config && <EmptyState>{t('scheduleJobsEmpty')}</EmptyState>
        )}
      </div>
    </Section>
  );
}
