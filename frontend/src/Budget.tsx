/*
 * Budget: the private AI ceiling and usage ledger (cloud only).
 * Live AI is disabled, so this is a personal safety ceiling, not a balance.
 * Styles live in styles/ai-settings.css (prefix ai-).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { cloudRequest } from './cloud';
import { Button, Check, Chip, EmptyState, Field, Notice, Section } from './ui';

type Attempt = {
  id: string;
  created_at: string;
  state: string;
  provider: string;
  model: string;
  reserved_eur: number;
  estimated_eur: number | null;
  actual_eur: number | null;
};

type Summary = {
  revision: number;
  monthly_eur: number;
  paused: boolean;
  live_enabled: boolean;
  month: string;
  posted_eur: number;
  held_eur: number;
  unknown_eur: number;
  remaining_eur: number;
  alert: string;
  last_reconciled_at: string | null;
  attempts: Attempt[];
};

/** What the status line under the heading reports. */
type Activity = 'loading' | 'saving' | 'saved' | 'idle';

const request = (action: string, args: Record<string, unknown> = {}) =>
  cloudRequest('/ai/budget', 'POST', { action, args }) as Promise<Summary>;

/** Share of the bar for one figure, clamped so a bad figure cannot overflow it. */
function share(amount: number, total: number) {
  if (!(total > 0) || !(amount > 0)) return 0;
  return Math.min(100, (amount / total) * 100);
}

export default function Budget() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<Summary | null>(null);
  const [limit, setLimit] = useState('20');
  const [paused, setPaused] = useState(false);
  const [activity, setActivity] = useState<Activity>('loading');
  const [error, setError] = useState(false);
  const busy = activity === 'loading' || activity === 'saving';

  const money = (amount: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);

  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(value));

  function accept(value: Summary) {
    setData(value);
    setLimit(String(value.monthly_eur));
    setPaused(value.paused);
  }

  async function refresh() {
    setActivity('loading');
    setError(false);
    try {
      accept(await request('get'));
    } catch {
      setData(null);
      setError(true);
    } finally {
      setActivity('idle');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    if (!data) return;
    setActivity('saving');
    setError(false);
    let next: Activity = 'idle';
    try {
      accept(await request('save', { revision: data.revision, monthly_eur: limit, paused }));
      next = 'saved';
    } catch {
      setData(null);
      setError(true);
    } finally {
      setActivity(next);
    }
  }

  const statusText =
    activity === 'loading'
      ? t('aiLoading')
      : activity === 'saving'
        ? t('aiSaving')
        : activity === 'saved'
          ? t('saved')
          : '';

  // Unknown cost is part of the held amount, so it is drawn inside the held share.
  const total = data ? Math.max(data.monthly_eur, data.posted_eur + data.held_eur) : 0;
  const unknown = data ? Math.min(data.unknown_eur, data.held_eur) : 0;

  return (
    <Section
      className="ai-panel"
      title={t('budgetTitle')}
      ariaLabel={t('budgetTitle')}
      description={t('budgetNotice')}
      actions={
        <Button size="sm" icon={RefreshCw} disabled={busy} onClick={() => void refresh()}>
          {t('aiRefresh')}
        </Button>
      }
    >
      <p className="ai-status" aria-live="polite" data-activity={activity}>
        {statusText}
      </p>

      {error && (
        <Notice tone="error" role="alert">
          {t('sharingError')}
        </Notice>
      )}

      {data && (
        <div className="ai-body" aria-busy={busy}>
          <div className="ai-budget__summary">
            <div className="ai-budget__period">
              <div className="fact">
                <span className="fact__label">{t('budgetPeriod')}</span>
                <span className="fact__value">{data.month}</span>
              </div>
              {data.paused && <Chip tone="lamp">{t('aiBudgetPaused')}</Chip>}
            </div>

            {/* Decorative: every figure in the bar is stated in the list below. */}
            <div className="ai-budget__bar" aria-hidden="true">
              <span
                className="ai-budget__segment"
                data-part="posted"
                style={{ inlineSize: `${share(data.posted_eur, total)}%` }}
              />
              <span
                className="ai-budget__segment"
                data-part="held"
                style={{ inlineSize: `${share(data.held_eur - unknown, total)}%` }}
              />
              <span
                className="ai-budget__segment"
                data-part="unknown"
                style={{ inlineSize: `${share(unknown, total)}%` }}
              />
            </div>

            <dl className="ai-budget__figures">
              <div className="ai-budget__figure" data-part="posted">
                <dt>{t('budgetPosted')}</dt>
                <dd>{money(data.posted_eur)}</dd>
              </div>
              <div className="ai-budget__figure" data-part="held">
                <dt>{t('budgetHeld')}</dt>
                <dd>{money(data.held_eur)}</dd>
              </div>
              <div className="ai-budget__figure ai-budget__figure--nested" data-part="unknown">
                <dt>{t('budgetUnknown')}</dt>
                <dd>{money(data.unknown_eur)}</dd>
              </div>
              <div className="ai-budget__figure" data-part="remaining">
                <dt>{t('budgetRemaining')}</dt>
                <dd>{money(data.remaining_eur)}</dd>
              </div>
            </dl>

            {data.alert !== 'none' && (
              <Notice tone="warning" role="status">
                {t('budgetAlert', { level: data.alert })}
              </Notice>
            )}

            <p className="ai-budget__reconciled">
              <span className="muted">{t('budgetLastReconciled')}: </span>
              {data.last_reconciled_at ? date(data.last_reconciled_at) : t('budgetNoReconciliation')}
            </p>
          </div>

          <form
            className="ai-budget__form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label={t('budgetPersonalLimit')} className="ai-budget__limit">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={20}
                step="0.000001"
                required
                value={limit}
                disabled={busy}
                onChange={(event) => setLimit(event.target.value)}
              />
            </Field>
            <Check
              label={t('budgetPause')}
              checked={paused}
              disabled={busy}
              onChange={(event) => setPaused(event.target.checked)}
            />
            <div>
              <Button type="submit" disabled={busy}>
                {t('save')}
              </Button>
            </div>
          </form>

          <div className="ai-block">
            <h3>{t('budgetLedger')}</h3>
            {data.attempts.length === 0 && <EmptyState>{t('budgetEmpty')}</EmptyState>}
            {data.attempts.length > 0 && (
              <ul className="rows ai-ledger">
                {data.attempts.map((attempt) => (
                  <li key={attempt.id} className="ai-ledger__item" data-state={attempt.state}>
                    <span className="ai-ledger__state">{t('budgetState_' + attempt.state)}</span>
                    <span className="ai-ledger__amount">
                      {money(
                        attempt.actual_eur ??
                          attempt.estimated_eur ??
                          (attempt.state === 'cancelled' ? 0 : attempt.reserved_eur),
                      )}
                    </span>
                    <span className="ai-ledger__source">
                      <span>{attempt.provider}</span>
                      <span>{attempt.model}</span>
                    </span>
                    <time className="ai-ledger__time" dateTime={attempt.created_at}>
                      {date(attempt.created_at)} UTC
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
