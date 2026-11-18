import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Eye, RefreshCw, ShieldCheck } from 'lucide-react';
import { cloudRequest } from './cloud';
import { pollDelay, startPolling } from './polling';
import type { Workspace } from './membership-api';
import type { Entry } from './api';
import { Button, Check, Chip, ConfirmDialog, EmptyState, Field, Notice, Section } from './ui';

type Recipient = { user_id: string; alias: string; revoked: boolean };
type Sent = { id: string; entry_id: string; recipients: Recipient[] };
type Received = { id: string; alias: string; created_at: string };
type Shares = { sent: Sent[]; received: Received[] };
type Done = 'share' | 'revoke' | null;

const EXCERPT_LENGTH = 65;

const action = (name: string, args: Record<string, unknown> = {}) =>
  cloudRequest('/sharing', 'POST', { action: name, args });

function formatDay(iso: string, language: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export default function Sharing({ entries }: { entries: Entry[] }) {
  const { t, i18n } = useTranslation();
  const [spaces, setSpaces] = useState<Workspace>({ relationships: [], blocks: [] });
  const [shares, setShares] = useState<Shares>({ sent: [], received: [] });
  const [entryId, setEntry] = useState('');
  const [spaceId, setSpace] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState<{ id: string; text: string } | null>(null);
  // Presentation only: whether the first access check has answered, and the last
  // completed action, so the region can say what just happened.
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const currentSpace = useRef(spaceId);
  currentSpace.current = spaceId;
  const sequence = useRef(0);
  const ids = useId();

  const selected = spaces.relationships.find((space) => space.id === spaceId);
  const eligible = selected?.members.filter((member) => member.can_contact && !member.is_self) ?? [];
  const available = spaces.relationships.filter((space) => !space.mine.archived && !space.mine.muted);
  const chosenEntry = entries.find((entry) => entry.id === entryId);
  const chosenPeople = eligible.filter((member) => recipients.includes(member.user_id));

  const refresh = useCallback(async () => {
    const n = ++sequence.current;
    setOpened(null);
    setReview(false);
    try {
      const {workspace,shares:nextShares} = await cloudRequest('/sharing/refresh','GET',undefined) as {workspace:Workspace;shares:Shares};
      if (n === sequence.current) {
        setSpaces(workspace);
        setShares(nextShares);
        // A completed background refresh must not erase a still-valid selection.
        const members =
          workspace.relationships.find((space) => space.id === currentSpace.current)?.members ?? [];
        setRecipients((previous) =>
          previous.filter((id) =>
            members.some((member) => member.user_id === id && member.can_contact && !member.is_self),
          ),
        );
        setError(false);
        setLoaded(true);
      }
    } catch {
      if (n === sequence.current) {
        setSpaces({ relationships: [], blocks: [] });
        setShares({ sent: [], received: [] });
        setRecipients([]);
        setError(true);
      }
      throw new Error('Sharing refresh unavailable');
    }
  }, []);

  useEffect(() => {
    // Opened copies and a pending review never stay on screen while the tab is hidden.
    const hide = () => {
      ++sequence.current;
      setOpened(null);
      setReview(false);
    };
    document.addEventListener('visibilitychange', hide);
    const stop = startPolling(refresh, { delay: failures => pollDelay(true, false, failures) });
    return () => {
      ++sequence.current;
      stop();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [refresh]);

  async function mutate(name: 'share' | 'revoke', args: Record<string, unknown>) {
    setBusy(true);
    setError(false);
    setReview(false);
    setDone(null);
    try {
      await action(name, args);
      setDone(name);
      await refresh();
    } catch {
      setOpened(null);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function read(id: string) {
    const n = ++sequence.current;
    setOpened(null);
    setBusy(true);
    setError(false);
    setDone(null);
    try {
      const value = await action('read', { share_id: id });
      if (n === sequence.current) setOpened(value);
    } catch {
      if (n === sequence.current) setError(true);
    } finally {
      setBusy(false);
    }
  }

  function openReview(event: FormEvent) {
    event.preventDefault();
    setReview(true);
  }

  function excerpt(text: string | undefined) {
    if (text === undefined) return null;
    return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
  }

  const reviewHintId = `${ids}-review-hint`;

  return (
    <Section
      className="sharing-region"
      title={t('sharingTitle')}
      ariaLabel={t('sharingTitle')}
      actions={
        <Button size="sm" icon={RefreshCw} disabled={busy} onClick={() => void refresh().catch(() => undefined)}>
          {t('sharingRefresh')}
        </Button>
      }
    >
      <div className="sharing-status" role="status">
        {!loaded && !error && <p className="muted text-sm">{t('sharingLoading')}</p>}
        {done && !error && (
          <Notice>{t(done === 'share' ? 'sharingShared' : 'sharingRevokedDone')}</Notice>
        )}
      </div>

      {error && (
        <Notice tone="error" role="alert">
          {t('sharingError')}
        </Notice>
      )}

      <div className="sharing-part">
        <h3>{t('sharingCopyTitle')}</h3>
        <Notice icon={ShieldCheck}>{t('sharingPolicy')}</Notice>

        <form className="sharing-form" onSubmit={openReview}>
          <div className="sharing-form__selects">
            <Field
              label={t('sharingReflection')}
              hint={entries.length === 0 ? t('sharingNoReflections') : undefined}
            >
              <select
                aria-label={t('sharingReflection')}
                required
                value={entryId}
                onChange={(event) => {
                  setEntry(event.target.value);
                  setReview(false);
                  setDone(null);
                }}
              >
                <option value="">{t('sharingChoose')}</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.text.slice(0, EXCERPT_LENGTH)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t('relationships')}
              hint={loaded && !error && available.length === 0 ? t('sharingNoRelationships') : undefined}
            >
              <select
                aria-label={t('relationships')}
                required
                value={spaceId}
                onChange={(event) => {
                  setSpace(event.target.value);
                  setRecipients([]);
                  setReview(false);
                  setDone(null);
                }}
              >
                <option value="">{t('sharingChoose')}</option>
                {available.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset className="sharing-recipients">
            <legend className="sharing-recipients__legend">{t('sharingRecipients')}</legend>
            {eligible.length === 0 && (
              <p className="muted text-sm">
                {t(!selected ? 'sharingPickRelationship' : selected.members.some((member) => !member.is_self) ? 'sharingNoRecipients' : 'sharingOnlyYou')}
              </p>
            )}
            {eligible.length > 0 && (
              <div className="sharing-recipients__list">
                {eligible.map((member) => (
                  <Check
                    key={member.user_id}
                    label={member.alias}
                    checked={recipients.includes(member.user_id)}
                    onChange={(event) => {
                      setReview(false);
                      setDone(null);
                      setRecipients((previous) =>
                        event.target.checked
                          ? [...previous, member.user_id]
                          : previous.filter((id) => id !== member.user_id),
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </fieldset>

          <div className="sharing-form__submit">
            <Button
              type="submit"
              aria-describedby={reviewHintId}
              disabled={busy || !entryId || !selected || recipients.length === 0}
            >
              {t('sharingReview')}
            </Button>
            <p className="muted text-sm" id={reviewHintId}>
              {t('sharingReviewHint')}
            </p>
          </div>
        </form>
      </div>

      <ConfirmDialog
        className="sharing-review"
        open={review}
        title={t('sharingReview')}
        confirmLabel={t('sharingConfirm')}
        cancelLabel={t('cancelAction')}
        confirmDisabled={busy}
        onConfirm={() =>
          void mutate('share', {
            entry_id: entryId,
            relationship_id: spaceId,
            membership_version: selected?.membership_version,
            recipients,
          })
        }
        onCancel={() => setReview(false)}
      >
        <div className="sharing-review__block">
          <h3 className="sharing-review__label">{t('sharingReflection')}</h3>
          <p className="sharing-review__text">{chosenEntry?.text}</p>
        </div>
        <div className="sharing-review__block">
          <h3 className="sharing-review__label">{t('sharingRecipients')}</h3>
          <ul className="sharing-review__people">
            {chosenPeople.map((member) => (
              <li key={member.user_id}>{member.alias}</li>
            ))}
          </ul>
        </div>
        <Notice icon={ShieldCheck}>{t('sharingPolicy')}</Notice>
      </ConfirmDialog>

      <div className="sharing-part sharing-part--ruled">
        <h3>{t('sharingSent')}</h3>
        {shares.sent.length === 0 ? (
          loaded && !error && <EmptyState>{t('sharingSentEmpty')}</EmptyState>
        ) : (
          <ul className="sharing-sent">
            {shares.sent.map((share) => {
              const text = excerpt(entries.find((entry) => entry.id === share.entry_id)?.text);
              return (
                <li className="sharing-sent__item" key={share.id}>
                  {text === null ? (
                    <p className="muted text-sm">{t('sharingEntryMissing')}</p>
                  ) : (
                    <p className="sharing-sent__excerpt">{text}</p>
                  )}
                  <ul className="rows sharing-people">
                    {share.recipients.map((recipient) => {
                      const nameId = `${ids}-${share.id}-${recipient.user_id}`;
                      return (
                        <li
                          className="sharing-person"
                          key={recipient.user_id}
                          data-revoked={recipient.revoked}
                        >
                          <span className="sharing-person__who">
                            <span className="sharing-person__name" id={nameId}>
                              {recipient.alias}
                            </span>
                            <Chip
                              tone={recipient.revoked ? 'neutral' : 'action'}
                              icon={recipient.revoked ? Ban : Eye}
                            >
                              {t(recipient.revoked ? 'sharingRevoked' : 'sharingReadOnly')}
                            </Chip>
                          </span>
                          {!recipient.revoked && (
                            <Button
                              size="sm"
                              aria-describedby={nameId}
                              disabled={busy}
                              onClick={() =>
                                void mutate('revoke', {
                                  share_id: share.id,
                                  recipient: recipient.user_id,
                                })
                              }
                            >
                              {t('sharingRevoke')}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sharing-part sharing-part--ruled">
        <h3>{t('sharingReceived')}</h3>
        {shares.received.length === 0 ? (
          loaded && !error && <EmptyState>{t('sharingEmpty')}</EmptyState>
        ) : (
          <ul className="rows sharing-people">
            {shares.received.map((share) => {
              const nameId = `${ids}-${share.id}-from`;
              const day = formatDay(share.created_at, i18n.language);
              return (
                <li className="sharing-person" key={share.id}>
                  <span className="sharing-person__who">
                    <span className="sharing-person__name" id={nameId}>
                      {share.alias}
                    </span>
                    <Chip icon={Eye}>{t('sharingReadOnly')}</Chip>
                    {day && (
                      <span className="sharing-person__date">
                        {t('sharingReceivedOn', { date: day })}
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    aria-describedby={nameId}
                    disabled={busy}
                    onClick={() => void read(share.id)}
                  >
                    {t('sharingOpen')}
                  </Button>
                  {opened?.id === share.id && (
                    <div className="sharing-copy">
                      <p className="received-text">{opened.text}</p>
                      <p className="sharing-copy__hint">{t('sharingOpenedHint')}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Section>
  );
}
