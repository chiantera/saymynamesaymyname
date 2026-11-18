/*
 * Cloud relationships: zero, one or many, each with one or more members.
 * Holds the invitation review (JoinInvitation) and the membership screen.
 * Every write goes through `perform`, which refreshes the workspace afterwards;
 * generation, version and membership_version arguments guard stale actions and
 * must stay on every call. Leaving and blocking always confirm in a dialog.
 */
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { pollDelay, startPolling } from './polling';
import {
  Archive,
  ArchiveRestore,
  Ban,
  Bell,
  BellOff,
  Check as CheckIcon,
  Copy,
  Link as LinkIcon,
  LogOut,
  Plus,
  RefreshCw,
  TriangleAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { isCloudActive } from './cloud';
import {
  clearInvitation,
  invitationLink,
  invitationProblem,
  pendingInvitation,
} from './invitation-links';
import {
  membership,
  type Invitation,
  type InvitePreview,
  type Member,
  type Space,
  type Workspace,
} from './membership-api';
import { Button, Check, Chip, ConfirmDialog, EmptyState, Field, Notice, Section } from './ui';

/** First visible character of a chosen name, for the decorative avatar. */
function initial(name: string, language: string) {
  const first = Array.from(name.trim())[0] ?? '';
  return first.toLocaleUpperCase(language);
}

function formatExpiry(iso: string, language: string) {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/* Invitation review: shown above every destination while a link is pending. */

export function JoinInvitation({ onJoined, onDismissed }: { onJoined: () => void; onDismissed?: () => void }) {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState(pendingInvitation);
  const [problem, setProblem] = useState(invitationProblem);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [alias, setAlias] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const cloudActive = isCloudActive();

  useEffect(() => {
    let current = true;
    if (token && cloudActive) {
      void membership
        .preview(token)
        .then((value) => {
          if (current) setPreview(value);
        })
        .catch(() => {
          if (current) setProblem(true);
        });
    }
    return () => {
      current = false;
    };
  }, [token, cloudActive]);

  function dismiss() {
    clearInvitation();
    setToken(null);
    setProblem(false);
    onDismissed?.();
  }

  async function decide(action: 'accept' | 'decline') {
    if (!token) return;
    setBusy(true);
    try {
      await membership.action(action, { token, alias });
      dismiss();
      if (action === 'accept') onJoined();
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
    }
  }

  if (!token && !problem) return null;

  const dismissButton = (
    <Button size="sm" icon={X} disabled={busy} onClick={dismiss}>
      {t('dismissInvitation')}
    </Button>
  );

  return (
    <Section
      raised
      className="rel-review"
      ariaLabel={t('invitationReview')}
      title={t('invitationReview')}
    >
      {problem ? (
        <Notice tone="error" role="alert" icon={TriangleAlert} actions={dismissButton}>
          <p>{t('inviteUnavailable')}</p>
        </Notice>
      ) : !cloudActive ? (
        <>
          <p>{t('inviteSignIn')}</p>
          <div>{dismissButton}</div>
        </>
      ) : !preview ? (
        <>
          <p className="muted" role="status">
            {t('inviteLoading')}
          </p>
          <div>{dismissButton}</div>
        </>
      ) : (
        <>
          <div className="rel-review__summary">
            <h3 className="rel-review__label">{preview.label}</h3>
            <div className="rel-review__members">
              <span className="rel-review__caption">{t('currentMembers')}</span>
              <ul className="rel-names">
                {preview.members.map((name, index) => (
                  <li key={`${index}-${name}`} className="rel-names__item">
                    <span className="rel-avatar rel-avatar--sm" aria-hidden="true">
                      {initial(name, i18n.language)}
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="rel-note">
              {t('linkExpires', { date: formatExpiry(preview.expires_at, i18n.language) })}
            </p>
            <p className="rel-note">{t('membershipPrivacy')}</p>
          </div>
          <form
            className="rel-review__form"
            onSubmit={(event) => {
              event.preventDefault();
              void decide('accept');
            }}
          >
            <Field label={t('memberAlias')} hint={t('aliasShared')}>
              <input
                value={alias}
                required
                maxLength={80}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setAlias(event.target.value)}
              />
            </Field>
            <Check
              label={t('joinConsent')}
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <div className="cluster">
              <Button
                type="submit"
                variant="primary"
                aria-busy={busy}
                disabled={busy || !alias.trim() || !consent}
              >
                {t('joinRelationship')}
              </Button>
              <Button disabled={busy} onClick={() => void decide('decline')}>
                {t('declineInvitation')}
              </Button>
            </div>
          </form>
        </>
      )}
    </Section>
  );
}

/* Membership screen */

export default function Relationships() {
  const { t, i18n } = useTranslation();
  const [workspace, setWorkspace] = useState<Workspace>({ relationships: [], blocks: [] });
  // Presentation only: tells "still loading" apart from "loaded and empty".
  const [loaded, setLoaded] = useState(false);
  const [label, setLabel] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const refresh = useCallback(async () => {
    setWorkspace(await membership.workspace());
    setLoaded(true);
  }, []);

  useEffect(() => {
    let current = true;
    const load = () =>
      membership
        .workspace()
        .then((value) => {
          if (current) {
            setWorkspace(value);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (current) setError(true);
          throw new Error('Membership refresh unavailable');
        });
    const stop = startPolling(load, { delay: failures => pollDelay(true, false, failures) });
    return () => {
      current = false;
      stop();
    };
  }, []);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      const value = await action();
      await refresh();
      return value;
    } catch {
      setError(true);
      await refresh().catch(() => undefined);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (await perform(() => membership.action('create', { label, alias }))) {
      setLabel('');
      setAlias('');
    }
  }

  const visible = workspace.relationships.filter((space) => showArchived || !space.mine.archived);
  const total = workspace.relationships.length;

  return (
    <div className="page page--split rel">
      <header className="page__header">
        <h1>{t('relationships')}</h1>
        <p className="page__lead">{t('emptyRelationships')}</p>
      </header>

      <div className="page__main">
        {error && (
          <Notice tone="error" role="alert" icon={TriangleAlert}>
            <p>{t('membershipError')}</p>
          </Notice>
        )}

        <section className="rel-list" aria-busy={busy}>
          <div className="rel-list__head">
            <h2>{t('relListTitle')}</h2>
            <Button
              size="sm"
              icon={RefreshCw}
              disabled={busy}
              onClick={() => void perform(async () => undefined)}
            >
              {t('refreshMemberships')}
            </Button>
          </div>
          {total > 0 && (
            <Check
              label={t('showArchived')}
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
          )}

          {!loaded && !error && (
            <p className="muted text-sm" role="status">
              {t('relLoading')}
            </p>
          )}
          {loaded && total === 0 && <EmptyState>{t('relEmptyCloud')}</EmptyState>}
          {loaded && total > 0 && visible.length === 0 && (
            <EmptyState icon={Archive}>{t('relAllArchived')}</EmptyState>
          )}

          {visible.map((space) => (
            <RelationshipCard
              key={space.id}
              space={space}
              busy={busy}
              failed={error}
              perform={perform}
            />
          ))}
        </section>

        {workspace.blocks.length > 0 && (
          <Section title={t('blockedPeople')} description={t('blockExplanation')}>
            <ul className="rel-members">
              {workspace.blocks.map((person) => (
                <li className="member-row" key={person.user_id}>
                  <span className="rel-avatar" aria-hidden="true">
                    {initial(person.alias, i18n.language)}
                  </span>
                  <span className="rel-member__body">
                    <span className="rel-member__name">{person.alias}</span>
                  </span>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void perform(() =>
                        membership.action('block', { user_id: person.user_id, value: false }),
                      )
                    }
                  >
                    {t('unblockPerson', { name: person.alias })}
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <aside className="page__aside rel-aside">
        <form className="rel-create" onSubmit={(event) => void create(event)}>
          <div className="rel-create__head">
            <h2 className="rel-create__title">{t('relCreateTitle')}</h2>
            <p className="rel-note">{t('relCreateHint')}</p>
          </div>
          <Field label={t('relationshipLabel')}>
            <input
              value={label}
              required
              maxLength={80}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
          <Field label={t('memberAlias')} hint={t('aliasShared')}>
            <input
              value={alias}
              required
              maxLength={80}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setAlias(event.target.value)}
            />
          </Field>
          <div>
            <Button
              type="submit"
              variant={total === 0 ? 'primary' : 'quiet'}
              icon={Plus}
              disabled={busy || !label.trim() || !alias.trim()}
            >
              {t('createRelationship')}
            </Button>
          </div>
        </form>

        <div className="rel-rules">
          <h2 className="rel-rules__title">{t('relRulesTitle')}</h2>
          <p className="rel-note">{t('membershipPrivacy')}</p>
          <p className="rel-note">{t('invitationRules')}</p>
        </div>
      </aside>
    </div>
  );
}

/* One relationship */

type Perform = (action: () => Promise<unknown>) => Promise<any>;

interface Confirmation {
  action: 'leave' | 'block';
  user_id?: string;
  name?: string;
}

interface RelationshipCardProps {
  space: Space;
  busy: boolean;
  /** The last action failed; repeated inside the open dialog, where the page notice is hidden. */
  failed: boolean;
  perform: Perform;
}

function RelationshipCard({ space, busy, failed, perform }: RelationshipCardProps) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [alias, setAlias] = useState(space.mine.alias);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const aliasHint = useId();

  useEffect(() => setAlias(space.mine.alias), [space.mine.alias]);
  // A membership change cancels pending invitations, so shown links are void.
  useEffect(() => {
    setLinks({});
    setCopied('');
  }, [space.membership_version]);

  const args = { relationship_id: space.id, generation: space.mine.generation };

  async function issue(id: string, version: number) {
    const value = await perform(() => membership.action('issue', { invitation_id: id, version }));
    if (value?.token) {
      setLinks((current) => ({
        ...current,
        [id]: invitationLink(window.location.origin, value.token),
      }));
    }
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(links[id]);
      setCopied(id);
    } catch {
      // The read-only field stays selectable if clipboard access is unavailable.
      setCopied('');
    }
  }

  async function confirm() {
    if (!confirmation) return;
    const value = await perform(() =>
      confirmation.action === 'leave'
        ? membership.action('leave', args)
        : membership.action('block', { user_id: confirmation.user_id, value: true }),
    );
    if (value !== undefined) setConfirmation(null);
  }

  function toggleBlock(person: Member) {
    if (person.blocked_by_me) {
      void perform(() => membership.action('block', { user_id: person.user_id, value: false }));
    } else {
      setConfirmation({ action: 'block', user_id: person.user_id, name: person.alias });
    }
  }

  const leaving = confirmation?.action === 'leave';

  return (
    <article className="rel-card" aria-label={space.label}>
      <header className="rel-card__head">
        <h2 className="rel-card__title">{space.label}</h2>
        {(space.mine.archived || space.mine.muted) && (
          <div className="cluster">
            {space.mine.archived && <Chip icon={Archive}>{t('archivedRelationship')}</Chip>}
            {space.mine.muted && <Chip icon={BellOff}>{t('relMutedByYou')}</Chip>}
          </div>
        )}
      </header>

      <section className="rel-card__part">
        <h3 className="rel-card__heading">{t('currentMembers')}</h3>
        <ul className="rel-members">
          {space.members.map((person) => (
            <li className="member-row" key={person.user_id}>
              <span className="rel-avatar" aria-hidden="true">
                {initial(person.alias, i18n.language)}
              </span>
              <span className="rel-member__body">
                <span className="rel-member__name">
                  {person.alias}
                  {person.is_self && <Chip tone="action">{t('you')}</Chip>}
                  {person.blocked_by_me && <Chip tone="danger">{t('relBlockedByYou')}</Chip>}
                </span>
                {!person.is_self && (
                  <span className="rel-member__contact" data-contact={person.can_contact}>
                    {t(person.can_contact ? 'contactAvailable' : 'contactUnavailable')}
                  </span>
                )}
              </span>
              {!person.is_self && (
                <Button
                  size="sm"
                  icon={person.blocked_by_me ? undefined : Ban}
                  disabled={busy}
                  onClick={() => toggleBlock(person)}
                >
                  {t(person.blocked_by_me ? 'unblockPerson' : 'blockPerson', {
                    name: person.alias,
                  })}
                </Button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="rel-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(() => membership.action('alias', { ...args, alias }));
          }}
        >
          <Field label={t('memberAlias')}>
            <input
              value={alias}
              maxLength={80}
              required
              autoComplete="off"
              aria-describedby={aliasHint}
              disabled={busy}
              onChange={(event) => setAlias(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !alias.trim()}>
            {t('saveAlias')}
          </Button>
        </form>
        <p className="rel-note" id={aliasHint}>
          {t('aliasShared')}
        </p>
      </section>

      <section className="rel-card__part">
        <h3 className="rel-card__heading">{t('pendingInvitations')}</h3>
        <p className="rel-note">{t('linkOnly')}</p>
        <form
          className="rel-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(() =>
              membership.action('propose', {
                ...args,
                email,
                membership_version: space.membership_version,
              }),
            ).then((value) => {
              if (value) setEmail('');
            });
          }}
        >
          <Field label={t('inviteEmail')}>
            <input
              type="email"
              maxLength={254}
              required
              autoComplete="off"
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Button type="submit" icon={UserPlus} disabled={busy || !email.trim()}>
            {t('proposeInvitation')}
          </Button>
        </form>

        {space.invitations.length === 0 ? (
          <p className="muted text-sm">{t('noPendingInvitations')}</p>
        ) : (
          <ul className="rel-invites">
            {space.invitations.map((invite) => (
              <InvitationItem
                key={invite.id}
                invite={invite}
                busy={busy}
                link={links[invite.id]}
                copied={copied === invite.id}
                language={i18n.language}
                onApprove={() =>
                  void perform(() => membership.action('approve', { invitation_id: invite.id }))
                }
                onIssue={() => void issue(invite.id, invite.version)}
                onCancel={() =>
                  void perform(() =>
                    membership.action(invite.status === 'proposed' ? 'reject' : 'revoke', {
                      invitation_id: invite.id,
                    }),
                  )
                }
                onRevokeExpired={() =>
                  void perform(() => membership.action('revoke', { invitation_id: invite.id }))
                }
                onCopy={() => void copy(invite.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rel-card__part rel-own">
        <div className="rel-own__text">
          <h3 className="rel-card__heading">{t('relMembershipTitle')}</h3>
          <p className="rel-note">{t('relMembershipHint')}</p>
        </div>
        <div className="rel-own__actions">
          <Button
            icon={space.mine.archived ? ArchiveRestore : Archive}
            disabled={busy}
            onClick={() =>
              void perform(() =>
                membership.action('archive', { ...args, value: !space.mine.archived }),
              )
            }
          >
            {t(space.mine.archived ? 'unarchiveRelationship' : 'archiveRelationship')}
          </Button>
          <Button
            icon={space.mine.muted ? Bell : BellOff}
            disabled={busy}
            onClick={() =>
              void perform(() => membership.action('mute', { ...args, value: !space.mine.muted }))
            }
          >
            {t(space.mine.muted ? 'unmuteRelationship' : 'muteRelationship')}
          </Button>
          <Button
            variant="danger"
            icon={LogOut}
            className="rel-own__leave"
            disabled={busy}
            onClick={() => setConfirmation({ action: 'leave' })}
          >
            {t('leaveRelationship')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation
            ? t(leaving ? 'leaveRelationship' : 'blockPerson', { name: confirmation.name })
            : ''
        }
        confirmLabel={t(leaving ? 'confirmLeave' : 'confirmBlock')}
        cancelLabel={t('cancelAction')}
        tone="danger"
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirmation(null)}
      >
        <p>{t(leaving ? 'leaveExplanation' : 'blockExplanation')}</p>
        {failed && !busy && (
          <p className="rel-dialog-error" role="alert">
            {t('membershipError')}
          </p>
        )}
      </ConfirmDialog>
    </article>
  );
}

/* One pending invitation */

interface InvitationItemProps {
  invite: Invitation;
  busy: boolean;
  /** The link created in this session, if any. It is never stored. */
  link: string | undefined;
  copied: boolean;
  language: string;
  onApprove: () => void;
  onIssue: () => void;
  /** Rejects a proposal or revokes an issued link. */
  onCancel: () => void;
  onRevokeExpired: () => void;
  onCopy: () => void;
}

function InvitationItem({
  invite,
  busy,
  link,
  copied,
  language,
  onApprove,
  onIssue,
  onCancel,
  onRevokeExpired,
  onCopy,
}: InvitationItemProps) {
  const { t } = useTranslation();
  const expired = invite.status === 'expired';
  const issued = invite.status === 'issued';
  const share =
    invite.member_count > 0
      ? Math.min(100, Math.round((invite.approval_count / invite.member_count) * 100))
      : 0;

  return (
    <li className="rel-invite">
      <div className="rel-invite__head">
        <strong className="rel-invite__email">{invite.email}</strong>
        {expired ? (
          <Chip>{t('relInviteExpired')}</Chip>
        ) : issued ? (
          <Chip tone="action" icon={LinkIcon}>
            {t('relInviteIssued')}
          </Chip>
        ) : invite.approved ? (
          <Chip tone="action" icon={CheckIcon}>
            {t('relInviteApproved')}
          </Chip>
        ) : (
          <Chip tone="lamp">{t('relInviteWaiting')}</Chip>
        )}
      </div>

      <div className="rel-invite__approval">
        <span className="rel-progress" aria-hidden="true">
          <span className="rel-progress__fill" style={{ inlineSize: `${share}%` }} />
        </span>
        <span className="rel-invite__count">
          {t('approvalCount', { approved: invite.approval_count, total: invite.member_count })}
        </span>
      </div>

      {invite.expires_at && (
        <p className="rel-note">
          {t('linkExpires', { date: formatExpiry(invite.expires_at, language) })}
        </p>
      )}

      {!expired && invite.approved && !issued && !link && (
        <p className="text-sm rel-invite__next">{t('relInviteNextStep')}</p>
      )}

      {expired ? (
        <>
          <p className="text-sm">{t('invitationExpired')}</p>
          <div className="cluster">
            <Button size="sm" icon={X} disabled={busy} onClick={onRevokeExpired}>
              {t('cancelInvitation')}
            </Button>
          </div>
        </>
      ) : (
        <div className="cluster">
          {invite.status === 'proposed' && !invite.my_approval && (
            <Button size="sm" icon={CheckIcon} disabled={busy} onClick={onApprove}>
              {t('approveInvitation')}
            </Button>
          )}
          <Button
            size="sm"
            variant={invite.approved && !issued && !link ? 'primary' : undefined}
            icon={LinkIcon}
            disabled={busy || !invite.approved}
            onClick={onIssue}
          >
            {t(issued ? 'replaceInviteLink' : 'createInviteLink')}
          </Button>
          <Button size="sm" icon={X} disabled={busy} onClick={onCancel}>
            {t('cancelInvitation')}
          </Button>
        </div>
      )}

      {link && (
        <div className="rel-inline rel-invite__link">
          <Field label={t('inviteLink')}>
            <input readOnly value={link} onFocus={(event) => event.target.select()} />
          </Field>
          <Button icon={copied ? CheckIcon : Copy} disabled={busy} onClick={onCopy}>
            {t(copied ? 'linkCopied' : 'copyInviteLink')}
          </Button>
        </div>
      )}
    </li>
  );
}
