/*
 * The day band: Home's one signature element. A slim 24-hour strip in the
 * person's timezone showing quiet hours, now, today's check-ins and the
 * snoozed-until time. It draws only what preferences and the check-in snapshot
 * actually say; nothing here is invented, predicted or scheduled.
 *
 * `describeDay` is a pure function of its arguments. The component is a pure
 * function of its props; the caller supplies `now` from `useMinuteClock`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Checkin } from '../api';
import type { Locale } from '../domain';
import { clockMinutes, describeDay, usableTimezone } from '../day-band';

const MINUTES_IN_DAY = 24 * 60;
const SCALE_HOURS = [0, 6, 12, 18];

/** The current time, refreshed on each minute boundary and when the tab becomes visible again. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      // Land just after the next minute starts so the marker never lags a full minute.
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    const tick = () => {
      setNow(Date.now());
      schedule();
    };
    const onVisible = () => {
      // Background tabs throttle timers; catch up as soon as the person returns.
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return now;
}


function percent(minutes: number) {
  return `${(minutes / MINUTES_IN_DAY) * 100}%`;
}

export interface DayBandProps {
  /** Current time in epoch milliseconds, from `useMinuteClock`. */
  now: number;
  language: Locale;
  /** IANA timezone from saved preferences. */
  timezone: string;
  /** Saved quiet hours as clock strings, for example "22:00". */
  quietStart: string;
  quietEnd: string;
  /** Every check-in in the current snapshot, any status. */
  checkins: Checkin[];
}

export default function DayBand({
  now,
  language,
  timezone,
  quietStart,
  quietEnd,
  checkins,
}: DayBandProps) {
  const { t } = useTranslation();
  const zone = useMemo(() => usableTimezone(timezone), [timezone]);
  const model = useMemo(
    () => describeDay(now, zone, quietStart, quietEnd, checkins),
    [now, zone, quietStart, quietEnd, checkins],
  );

  const formatTime = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    });
    return (instant: number) => format.format(new Date(instant));
  }, [language, zone]);

  // Clock values (quiet hours, scale labels) are wall-clock times, not instants.
  const formatClock = useMemo(() => {
    const full = new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
    const hourOnly = new Intl.DateTimeFormat(language, { hour: 'numeric', timeZone: 'UTC' });
    return {
      time: (minutes: number) => full.format(new Date(Date.UTC(2000, 0, 1, 0, minutes))),
      hour: (hour: number) => hourOnly.format(new Date(Date.UTC(2000, 0, 1, hour))),
    };
  }, [language]);

  const nowText = formatTime(now);
  const startMinutes = clockMinutes(quietStart);
  const endMinutes = clockMinutes(quietEnd);

  // The same facts the strip draws, in words.
  const sentences = [t('homeBandNow', { time: nowText, timezone })];
  if (model.quiet.length > 0 && startMinutes !== null && endMinutes !== null) {
    sentences.push(
      t('homeBandQuiet', {
        start: formatClock.time(startMinutes),
        end: formatClock.time(endMinutes),
      }),
    );
    if (model.quietNow) sentences.push(t('homeBandQuietNow'));
  }
  if (model.marks.length === 0) {
    sentences.push(t('homeBandNoCheckins'));
  } else {
    const items = model.marks.map((mark) =>
      t('homeBandItem', { time: formatClock.time(mark.minutes), status: t(mark.status) }),
    );
    sentences.push(
      t('homeBandCheckins', {
        list: new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items),
      }),
    );
  }
  if (model.snooze) {
    sentences.push(t('homeBandSnoozed', { time: formatTime(model.snooze.instant) }));
  }

  return (
    <div className="home-band" role="img" aria-label={sentences.join(' ')}>
      <div className="home-band__track">
        <div className="home-band__fill">
          {model.quiet.map((segment) => (
            <span
              key={segment.start}
              className="home-band__quiet"
              style={{
                insetInlineStart: percent(segment.start),
                inlineSize: percent(segment.end - segment.start),
              }}
            />
          ))}
        </div>
        {model.marks.map((mark) => (
          <span
            key={mark.id}
            className="home-band__mark"
            data-status={mark.status}
            style={{ insetInlineStart: percent(mark.minutes) }}
          />
        ))}
        {model.snooze && model.snooze.minutes !== null && (
          <span
            className="home-band__snooze"
            style={{ insetInlineStart: percent(model.snooze.minutes) }}
          />
        )}
        <span className="home-band__now" style={{ insetInlineStart: percent(model.nowMinutes) }} />
      </div>
      <div className="home-band__scale">
        {SCALE_HOURS.map((hour) => (
          <span key={hour} className="home-band__hour">
            {formatClock.hour(hour)}
          </span>
        ))}
      </div>
      <p className="home-band__legend">
        <span className="home-band__legend-item">
          <span className="home-band__key" data-key="now" />
          {t('homeBandLegendNow', { time: nowText })}
        </span>
        {model.snooze && (
          <span className="home-band__legend-item">
            <span className="home-band__key" data-key="snooze" />
            {t('homeBandLegendSnoozed', { time: formatTime(model.snooze.instant) })}
          </span>
        )}
      </p>
    </div>
  );
}
