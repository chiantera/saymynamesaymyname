/*
 * Settings: one ordered page with an in-page index.
 *
 * Order: Preferences (timezone), Appearance (theme), Rhythm (read-only facts in
 * the local preview), then the cloud-only sections that App passes as children:
 * Scheduling, AI consent and Budget. Each section sits in a wrapper this file
 * owns, which carries the anchor id the index points at.
 */
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Check as CheckIcon, LocateFixed } from 'lucide-react';
import AIConsent from '../AIConsent';
import type { Preferences } from '../api';
import Budget from '../Budget';
import type { Locale } from '../domain';
import Scheduling from '../Scheduling';
import { Button, Field, Icon, Section } from '../ui';

export interface SettingsScreenProps {
  /** Private cloud session; selects which mode statement is shown. */
  cloud: boolean;
  /** A request is in flight: disable saving. */
  busy: boolean;
  language: Locale;
  /** Null until the first load finishes. */
  preferences: Preferences | null;
  /** Controlled value of the timezone field (an IANA name). */
  timezone: string;
  onTimezone: (timezone: string) => void;
  /** Saves the timezone with the current language. */
  onSave: () => void;
  /** True right after a successful save; announces the "saved" status. */
  saved: boolean;
  /** "system" | "light" | "dark". */
  theme: string;
  onTheme: (theme: string) => void;
  /** Cloud-only settings sections, rendered after the preferences. */
  children?: ReactNode;
}

const themes = ['system', 'light', 'dark'];

/** Anchor id and index label for each cloud section, matched by component. */
const cloudSections: { component: unknown; id: string; labelKey: string }[] = [
  { component: Scheduling, id: 'settings-scheduling', labelKey: 'settingsNavSchedule' },
  { component: AIConsent, id: 'settings-ai', labelKey: 'settingsNavAi' },
  { component: Budget, id: 'settings-budget', labelKey: 'settingsNavBudget' },
];

interface IndexEntry {
  id: string;
  label: string;
}

/** The device's own IANA timezone, or null when the browser does not say. */
function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Every timezone name the browser knows, for the field's suggestions. */
function knownTimezones(): string[] {
  try {
    return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  } catch {
    return [];
  }
}

/** The current time in a timezone, or null when the name is not recognised. */
function timeIn(zone: string, language: string): string | null {
  const name = zone.trim();
  if (!name) return null;
  try {
    return new Intl.DateTimeFormat(language, {
      timeZone: name,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    return null;
  }
}

/** Follows which section is under the top of the viewport, for the index. */
function useCurrentSection(ids: string[]): string {
  const key = ids.join(' ');
  const [current, setCurrent] = useState(ids[0] ?? '');

  useEffect(() => {
    const order = key.split(' ').filter(Boolean);
    if (typeof IntersectionObserver === 'undefined' || order.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = order.find((id) => visible.has(id));
        if (first) setCurrent(first);
      },
      // A band near the top of the viewport decides which section is "current".
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const id of order) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);

  return current;
}

export default function SettingsScreen({
  cloud,
  busy,
  language,
  preferences,
  timezone,
  onTimezone,
  onSave,
  saved,
  theme,
  onTheme,
  children,
}: SettingsScreenProps) {
  const { t } = useTranslation();
  const zonesId = useId();
  const zones = useMemo(knownTimezones, []);
  const deviceZone = useMemo(deviceTimezone, []);
  const localTime = timeIn(timezone, language);

  const cadence = new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'long',
  }).format(preferences?.cadence_hours ?? 6);
  const nudgeCap = new Intl.NumberFormat(language).format(preferences?.daily_nudge_cap ?? 3);
  const quietStart = preferences?.quiet_start ?? '22:00';
  const quietEnd = preferences?.quiet_end ?? '08:00';

  // Wrap each cloud section in an anchor this file owns, keeping App's order.
  const cloudBlocks = Children.toArray(children).map((child) => {
    const known = isValidElement(child)
      ? cloudSections.find((section) => section.component === child.type)
      : undefined;
    return { child, known };
  });

  const index: IndexEntry[] = [
    { id: 'settings-preferences', label: t('settingsPreferences') },
    { id: 'settings-appearance', label: t('theme') },
    ...(cloud ? [] : [{ id: 'settings-rhythm', label: t('settingsRhythm') }]),
    ...cloudBlocks.flatMap(({ known }) =>
      known ? [{ id: known.id, label: t(known.labelKey) }] : [],
    ),
  ];
  const current = useCurrentSection(index.map((entry) => entry.id));

  /*
   * Index links are real anchors, but the jump is done here so the address
   * fragment (which sign-in links also use) is never rewritten.
   */
  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }

  return (
    <div className="page page--split settings">
      <header className="page__header">
        <h1>{t('preferences')}</h1>
      </header>

      <nav className="settings-index" aria-label={t('settingsIndex')}>
        <p className="settings-index__title" aria-hidden="true">
          {t('settingsIndex')}
        </p>
        <ul className="settings-index__list">
          {index.map((entry) => (
            <li key={entry.id}>
              <a
                className="settings-index__link"
                href={`#${entry.id}`}
                aria-current={current === entry.id ? 'location' : undefined}
                onClick={(event) => jump(event, entry.id)}
              >
                {entry.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="settings-sections">
        <div className="settings-block" id="settings-preferences" tabIndex={-1}>
          <Section
            title={t('settingsPreferences')}
            description={t('settingsPreferencesLead')}
          >
            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <Field
                label={t('timezone')}
                hint={
                  localTime
                    ? t('settingsTimezoneNow', { time: localTime })
                    : t('settingsTimezoneHint')
                }
              >
                <input
                  value={timezone}
                  maxLength={80}
                  required
                  list={zones.length > 0 ? zonesId : undefined}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(event) => onTimezone(event.target.value)}
                />
              </Field>
              {zones.length > 0 && (
                <datalist id={zonesId}>
                  {zones.map((zone) => (
                    <option value={zone} key={zone} />
                  ))}
                </datalist>
              )}
              {deviceZone && deviceZone !== timezone && (
                <Button
                  size="sm"
                  icon={LocateFixed}
                  disabled={busy}
                  onClick={() => onTimezone(deviceZone)}
                >
                  {t('settingsUseDeviceTimezone')}
                </Button>
              )}
              {!preferences && <p className="muted text-sm">{t('settingsNotLoaded')}</p>}
              <div className="cluster">
                <Button type="submit" variant="primary" disabled={!preferences || busy}>
                  {t('save')}
                </Button>
                <span className="settings-saved" role="status">
                  {saved && (
                    <>
                      <Icon icon={CheckIcon} size={16} />
                      {t('saved')}
                    </>
                  )}
                </span>
              </div>
            </form>
          </Section>
        </div>

        <div className="settings-block" id="settings-appearance" tabIndex={-1}>
          <Section title={t('theme')}>
            <Field label={t('theme')} hideLabel hint={t('settingsThemeHint')} className="settings-narrow">
              <select value={theme} onChange={(event) => onTheme(event.target.value)}>
                {themes.map((value) => (
                  <option value={value} key={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </Field>
          </Section>
        </div>

        {!cloud && (
          <div className="settings-block" id="settings-rhythm" tabIndex={-1}>
            <Section title={t('settingsRhythm')} description={t('settingsRhythmLead')}>
              {preferences ? (
                <dl className="settings-facts">
                  <div className="fact">
                    <dt className="fact__label">{t('cadence')}</dt>
                    <dd className="fact__value">{cadence}</dd>
                  </div>
                  <div className="fact">
                    <dt className="fact__label">{t('nudgeCap')}</dt>
                    <dd className="fact__value">{nudgeCap}</dd>
                  </div>
                  <div className="fact">
                    <dt className="fact__label">{t('quietHours')}</dt>
                    <dd className="fact__value">
                      <span dir="ltr">
                        {quietStart}–{quietEnd}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="muted text-sm">{t('settingsNotLoaded')}</p>
              )}
              <p className="muted text-sm">{t('decisionWindow')}</p>
            </Section>
          </div>
        )}

        {cloudBlocks.map(({ child, known }, position) => (
          <div
            className="settings-block"
            id={known?.id}
            tabIndex={known ? -1 : undefined}
            key={known?.id ?? position}
          >
            {child}
          </div>
        ))}

        <footer className="settings-mode">
          <p>{t('contextOff')}</p>
          <p className="muted">{t(cloud ? 'cloudMode' : 'demoNotice')}</p>
        </footer>
      </div>
    </div>
  );
}
