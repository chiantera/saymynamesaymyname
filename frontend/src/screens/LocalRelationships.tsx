/*
 * Relationships in the fictional local preview: private labels only.
 * The cloud membership screen is Relationships.tsx; the two never mix.
 */
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Relationship } from '../api';
import { Button, Chip, EmptyState, Field } from '../ui';

export interface LocalRelationshipsProps {
  /** A request is in flight: disable the form. */
  busy: boolean;
  /** Preferences have loaded, so the local session exists. */
  ready: boolean;
  /** Zero or more private relationships; never assume a number or a shape. */
  relationships: Relationship[];
  /** Controlled value of the new relationship's label. App clears it after a successful add. */
  label: string;
  onLabel: (label: string) => void;
  /** Adds a private relationship with the current label. */
  onAdd: () => void;
}

export default function LocalRelationships({
  busy,
  ready,
  relationships,
  label,
  onLabel,
  onAdd,
}: LocalRelationshipsProps) {
  const { t, i18n } = useTranslation();
  const empty = relationships.length === 0;

  return (
    <div className="page rel">
      <header className="page__header">
        <h1>{t('relationships')}</h1>
        <p className="page__lead">{t('emptyRelationships')}</p>
        <p className="rel-note">{t('relationshipScope')}</p>
      </header>

      <section className="rel-list" aria-busy={busy}>
        <div className="rel-list__head">
          <h2>{t('relListTitle')}</h2>
        </div>
        {!ready ? (
          <p className="muted text-sm" role="status">
            {t('relLoading')}
          </p>
        ) : empty ? (
          <EmptyState>{t('relEmptyLocal')}</EmptyState>
        ) : (
          <div className="rel-local">
            {relationships.map((relationship) => (
              <article
                className="rel-local__item"
                key={relationship.id}
                aria-label={relationship.label}
              >
                <span className="rel-avatar" aria-hidden="true">
                  {(Array.from(relationship.label.trim())[0] ?? '').toLocaleUpperCase(
                    i18n.language,
                  )}
                </span>
                <h3 className="rel-local__label">{relationship.label}</h3>
                <Chip>{t('privateLabel')}</Chip>
              </article>
            ))}
          </div>
        )}
      </section>

      <form
        className="rel-create rel-create--local"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <div className="rel-create__head">
          <h2 className="rel-create__title">{t('relCreateTitle')}</h2>
        </div>
        <div className="rel-inline">
          <Field label={t('relationshipLabel')}>
            <input
              value={label}
              required
              maxLength={80}
              autoComplete="off"
              onChange={(event) => onLabel(event.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant={empty ? 'primary' : 'quiet'}
            icon={Plus}
            disabled={busy || !ready || !label.trim()}
          >
            {t('addRelationship')}
          </Button>
        </div>
      </form>
    </div>
  );
}
