/*
 * Growth: planned, not connected. States what the area will be for, lists what
 * is planned as plain text (no controls, nothing that looks operable) and
 * points back to Home, where the private check-in already works.
 */
import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Notice, Section } from '../ui';

export interface GrowthProps {
  /** Switches to the Home destination. */
  onHome: () => void;
}

/** Catalog keys of the planned items, in display order. */
const planned = [
  'growthPlanGoals',
  'growthPlanHabits',
  'growthPlanMilestones',
  'growthPlanStreaks',
] as const;

export default function Growth({ onHome }: GrowthProps) {
  const { t } = useTranslation();
  return (
    <div className="page soon">
      <header className="page__header">
        <h1>{t('growth')}</h1>
        <p className="page__lead">{t('growthPurpose')}</p>
      </header>

      <Notice tone="warning" icon={Hourglass} className="soon-status">
        <strong className="soon-status__title">{t('upcoming')}</strong>
        <span>{t('notReady')}</span>
      </Notice>

      <Section title={t('soonPlannedTitle')} description={t('soonPlannedNote')}>
        <ul className="rows soon-list">
          {planned.map((key) => (
            <li key={key} className="soon-list__item">
              {t(key)}
            </li>
          ))}
        </ul>
      </Section>

      <div className="soon-action">
        <Button variant="primary" onClick={onHome}>
          {t('soonGoToCheckin')}
        </Button>
      </div>
    </div>
  );
}
