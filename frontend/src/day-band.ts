// Pure wall-clock model for the presentation-only day band.
import type { Checkin } from './api';
const MINUTES_IN_DAY = 24 * 60;

/** Returns the timezone if the runtime accepts it, otherwise undefined (the device timezone). */
export function usableTimezone(timezone: string): string | undefined {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    return timezone;
  } catch {
    return undefined;
  }
}

export interface ZonedMoment {
  /** Calendar day in the timezone, as YYYY-MM-DD. */
  day: string;
  /** Minutes since local midnight, 0 to 1439. */
  minutes: number;
}

/** Wall-clock day and minute of an instant in a timezone. Null for an unreadable instant. */
export function zonedMoment(instant: number, timezone: string | undefined): ZonedMoment | null {
  if (!Number.isFinite(instant)) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  const minutes = Number(part('hour')) * 60 + Number(part('minute'));
  if (!Number.isFinite(minutes)) return null;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, minutes };
}

/** "22:00" or "22:00:00" to minutes since midnight. Null when it is not a clock time. */
export function clockMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::00)?$/.exec(clock);
  if (!match) return null;
  if (Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < MINUTES_IN_DAY ? minutes : null;
}

export interface DaySegment {
  start: number;
  end: number;
}

export interface DayMark {
  id: string;
  status: string;
  minutes: number;
}

export interface DayModel {
  nowMinutes: number;
  /** Quiet hours as one or two segments of the local day; empty when unknown or zero-length. */
  quiet: DaySegment[];
  quietNow: boolean;
  /** Check-ins created today (local day), oldest first. */
  marks: DayMark[];
  /** The snoozed check-in's return time; `minutes` is null when it falls on another day. */
  snooze: { instant: number; minutes: number | null } | null;
}

export function describeDay(
  now: number,
  timezone: string | undefined,
  quietStart: string,
  quietEnd: string,
  checkins: Checkin[],
): DayModel {
  const today = zonedMoment(now, timezone) ?? { day: '', minutes: 0 };

  const start = clockMinutes(quietStart);
  const end = clockMinutes(quietEnd);
  const quiet: DaySegment[] = [];
  if (start !== null && end !== null && start !== end) {
    if (start < end) {
      quiet.push({ start, end });
    } else {
      // Quiet hours cross midnight: the end of today and the start of today.
      if (end > 0) quiet.push({ start: 0, end });
      quiet.push({ start, end: MINUTES_IN_DAY });
    }
  }
  const quietNow = quiet.some(
    (segment) => today.minutes >= segment.start && today.minutes < segment.end,
  );

  const marks: DayMark[] = [];
  for (const checkin of checkins) {
    const created = zonedMoment(Date.parse(checkin.created_at), timezone);
    if (created && created.day === today.day) {
      marks.push({ id: checkin.id, status: checkin.status, minutes: created.minutes });
    }
  }
  marks.sort((a, b) => a.minutes - b.minutes);

  let snooze: DayModel['snooze'] = null;
  const snoozed = checkins.find(
    (checkin) => checkin.status === 'deferred' && checkin.snoozed_until,
  );
  if (snoozed?.snoozed_until) {
    const instant = Date.parse(snoozed.snoozed_until);
    const until = zonedMoment(instant, timezone);
    if (until) {
      snooze = { instant, minutes: until.day === today.day ? until.minutes : null };
    }
  }

  return { nowMinutes: today.minutes, quiet, quietNow, marks, snooze };
}
