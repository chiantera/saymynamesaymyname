/*
 * Home: the day band, the check-in (start one, or decide on the pending draft)
 * and the dated journal of saved reflections.
 * Presentation only; every action is a callback owned by App.tsx.
 */
import { useId, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Check, Hourglass, Lock, Moon, SkipForward, TriangleAlert } from 'lucide-react';
import type { Checkin, Entry, Preferences, Relationship, Snapshot } from '../api';
import type { Locale } from '../domain';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Icon,
  Notice,
  Section,
  type ChipProps,
  type LucideIcon,
} from '../ui';
import DayBand, { useMinuteClock } from './DayBand';
import { clockMinutes, usableTimezone, zonedMoment } from '../day-band';

export type Decision = 'approve' | 'skip' | 'snooze';

export interface HomeProps {
  /** Private cloud session. The scope picker is disabled there, as before. */
  cloud: boolean;
  /** A request is in flight: disable every action. */
  busy: boolean;
  /** Preferences are loaded, nothing is in flight and no check-in is pending, snoozed or queued. */
  canGenerate: boolean;
  language: Locale;
  /** Null until the first load finishes. Holds timezone, quiet hours, cadence and nudge cap. */
  preferences: Preferences | null;
  /** The timezone to display: saved preference, or the form default before loading. */
  timezone: string;
  /** Current check-ins (all statuses) and worker jobs. */
  snapshot: Snapshot;
  /** Saved private reflections, newest first as delivered by the API. */
  entries: Entry[];
  /** Local-preview relationships for the scope picker. */
  relationships: Relationship[];
  /** Selected relationship id, or '' for a solo check-in. */
  scope: string;
  onScope: (relationshipId: string) => void;
  /** The editable draft text for the pending check-in. */
  draft: string;
  onDraft: (text: string) => void;
  onGenerate: () => void;
  /** Sends the decision with the check-in's version; approve saves the current draft. */
  onDecide: (checkin: Checkin, decision: Decision) => void;
  /** Formats an ISO timestamp in the person's language and timezone. */
  formatDate: (iso: string) => string;
  /** Rendered after the reflections (the cloud Sharing section). */
  children?: ReactNode;
}

/* Status marks pair a tone with an icon or dot, so colour is never the only signal. */
const statusMark: Record<string, { tone: ChipProps['tone']; icon?: LucideIcon }> = {
  fulfilled: { tone: 'action', icon: Check },
  skipped: { tone: 'neutral', icon: SkipForward },
  deferred: { tone: 'lamp' },
  failed: { tone: 'danger', icon: TriangleAlert },
  cancelled: { tone: 'neutral', icon: Ban },
};

interface JournalDay {
  /** Local calendar day, YYYY-MM-DD; also the React key. */
  day: string;
  /** Any instant on that day, for the heading. */
  instant: number;
  entries: Entry[];
}

/** Groups reflections by local calendar day, keeping the order the API delivered. */
function groupByDay(entries: Entry[], timezone: string | undefined): JournalDay[] {
  const days: JournalDay[] = [];
  for (const entry of entries) {
    const instant = Date.parse(entry.created_at);
    const day = zonedMoment(instant, timezone)?.day ?? '';
    const last = days[days.length - 1];
    if (last && last.day === day) {
      last.entries.push(entry);
    } else {
      days.push({ day, instant, entries: [entry] });
    }
  }
  return days;
}

export default function Home({
  cloud,
  busy,
  canGenerate,
  language,
  preferences,
  timezone,
  snapshot,
  entries,
  relationships,
  scope,
  onScope,
  draft,
  onDraft,
  onGenerate,
  onDecide,
  formatDate,
  children,
}: HomeProps) {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const startHintId = useId();
  const draftNoteId = useId();

  const active = snapshot.checkins.find((checkin) => checkin.status === 'pending');
  const snoozed = snapshot.checkins.find(
    (checkin) => checkin.status === 'deferred' && checkin.snoozed_until,
  );
  const queued = snapshot.jobs.some((job) => job.status === 'queued' || job.status === 'processing');
  const history = snapshot.checkins.filter((checkin) => checkin.status !== 'pending').slice(0, 4);

  const zone = useMemo(() => usableTimezone(timezone), [timezone]);
  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: zone,
      }),
      clock: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
      day: new Intl.DateTimeFormat(language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: zone,
      }),
      dayWithYear: new Intl.DateTimeFormat(language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: zone,
      }),
      money: new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }),
    }),
    [language, zone],
  );
  // An unreadable timestamp renders as nothing instead of throwing.
  const formatTime = (iso: string) => {
    const instant = Date.parse(iso);
    return Number.isFinite(instant) ? formats.time.format(instant) : '';
  };
  const formatClock = (clock: string) => {
    const minutes = clockMinutes(clock);
    return minutes === null
      ? clock.slice(0, 5)
      : formats.clock.format(new Date(Date.UTC(2000, 0, 1, 0, minutes)));
  };

  const journal = useMemo(() => groupByDay(entries, zone), [entries, zone]);
  const thisYear = zonedMoment(now, zone)?.day.slice(0, 4);

  // The decision deadline is set by the server; show it only when it is really there.
  const deadline = active?.deadline ? Date.parse(active.deadline) : Number.NaN;
  const minutesLeft = Number.isFinite(deadline) ? Math.ceil((deadline - Date.now()) / 60_000) : 0;
  const draftEmpty = !draft.trim();

  // Why the start button is unavailable, in words, when the reason is knowable here.
  let startHint: string | null = null;
  if (!preferences) {
    if (busy) startHint = t('homeLoading');
  } else if (snoozed?.snoozed_until) {
    startHint = t('homeSnoozedHint', { time: formatTime(snoozed.snoozed_until) });
  }

  return (
    <div className="page home">
      <header className="page__header">
        <h1>{t('welcome')}</h1>
        <p className="page__lead">{t('lead')}</p>
      </header>

      <div className="home-day">
        {preferences ? (
          <DayBand
            now={now}
            language={language}
            timezone={timezone}
            quietStart={preferences.quiet_start}
            quietEnd={preferences.quiet_end}
            checkins={snapshot.checkins}
          />
        ) : (
          <div className="home-band home-band--empty" aria-hidden="true">
            <div className="home-band__track">
              <div className="home-band__fill" />
            </div>
          </div>
        )}
        <ul className="home-facts">
          {preferences && (
            <li className="home-facts__item">
              <Icon icon={Moon} size={14} />
              <span>
                {t('homeFactQuiet', {
                  start: formatClock(preferences.quiet_start),
                  end: formatClock(preferences.quiet_end),
                  timezone,
                })}
              </span>
            </li>
          )}
          <li className="home-facts__item">
            <span>{t('homeFactCost', { amount: formats.money.format(0) })}</span>
          </li>
        </ul>
      </div>

      <Section
        className="home-checkin"
        title={t('checkinTitle')}
        actions={<Chip icon={Lock}>{t('privateLabel')}</Chip>}
      >
        {queued && (
          <Notice role="status" icon={Hourglass}>
            <p>{t('working')}</p>
          </Notice>
        )}

        {active && (
          <article className="draft-card" aria-busy={busy}>
            <div>
              <Chip tone="lamp">{t('pending')}</Chip>
            </div>
            <h3 className="home-draft__prompt" dir="auto">
              {active.prompt}
            </h3>
            <Field label={t('review')} hint={t('decisionWindow')}>
              <textarea
                className="home-draft__text"
                dir="auto"
                value={draft}
                maxLength={5000}
                rows={6}
                aria-describedby={draftNoteId}
                onChange={(event) => onDraft(event.target.value)}
              />
            </Field>
            <div className="home-draft__notes" id={draftNoteId}>
              {Number.isFinite(deadline) && (
                <p>
                  {t('homeDeadline', { time: formatTime(active.deadline as string) })}{' '}
                  {minutesLeft > 0 && (
                    <span className="home-draft__left">
                      {t('homeDeadlineLeft', { minutes: minutesLeft })}
                    </span>
                  )}
                </p>
              )}
              {draftEmpty && <p>{t('homeDraftEmpty')}</p>}
            </div>
            <div className="home-draft__actions">
              <Button
                variant="primary"
                className="home-draft__save"
                disabled={busy || draftEmpty}
                onClick={() => onDecide(active, 'approve')}
              >
                {t('approve')}
              </Button>
              <Button disabled={busy} onClick={() => onDecide(active, 'skip')}>
                {t('skip')}
              </Button>
              <Button disabled={busy} onClick={() => onDecide(active, 'snooze')}>
                {t('snooze')}
              </Button>
            </div>
          </article>
        )}

        {!active && (
          <div className="home-start">
            {!queued && snapshot.checkins.length === 0 && (
              <EmptyState className="home-start__empty">{t('emptyCheckins')}</EmptyState>
            )}
            <div className="home-start__controls">
              <Field
                label={t('homeScopeLabel')}
                hint={cloud ? t('homeScopeCloud') : undefined}
                className="home-start__scope"
              >
                <select
                  disabled={cloud}
                  value={scope}
                  onChange={(event) => onScope(event.target.value)}
                >
                  <option value="">{t('solo')}</option>
                  {relationships.map((relationship) => (
                    <option key={relationship.id} value={relationship.id}>
                      {relationship.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                variant="primary"
                className="home-start__go"
                disabled={!canGenerate}
                aria-describedby={startHint ? startHintId : undefined}
                onClick={onGenerate}
              >
                {t('generate')}
              </Button>
            </div>
            {startHint && (
              <p className="home-start__hint" id={startHintId}>
                {startHint}
              </p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="home-history">
            <h3 className="home-history__title">{t('homeRecent')}</h3>
            <ul className="home-history__list">
              {history.map((checkin) => {
                const mark = statusMark[checkin.status] ?? { tone: 'neutral' as const };
                return (
                  <li className="history-item" key={checkin.id}>
                    <Chip tone={mark.tone} icon={mark.icon}>
                      {t(checkin.status)}
                    </Chip>
                    {checkin.snoozed_until ? (
                      <time className="home-history__when" dateTime={checkin.snoozed_until}>
                        {t('homeHistoryUntil', { time: formatDate(checkin.snoozed_until) })}
                      </time>
                    ) : (
                      <time className="home-history__when" dateTime={checkin.created_at}>
                        {formatDate(checkin.created_at)}
                      </time>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      <Section className="home-journal" title={t('entries')}>
        {entries.length === 0 ? (
          <EmptyState>{t('emptyEntries')}</EmptyState>
        ) : (
          journal.map((group) => (
            <section className="home-journal__day" key={group.day}>
              {Number.isFinite(group.instant) && (
                <h3 className="home-journal__date">
                  {(group.day.slice(0, 4) === thisYear ? formats.day : formats.dayWithYear).format(
                    group.instant,
                  )}
                </h3>
              )}
              {group.entries.map((entry) => (
                <article className="entry" key={entry.id}>
                  <time className="entry__time" dateTime={entry.created_at}>
                    {formatTime(entry.created_at)}
                  </time>
                  <p className="entry__text" lang={entry.locale} dir="auto">
                    {entry.text}
                  </p>
                  <div className="entry__meta">
                    <Chip icon={Lock}>{t('privateLabel')}</Chip>
                  </div>
                </article>
              ))}
            </section>
          ))
        )}
      </Section>

      {children}
    </div>
  );
}
