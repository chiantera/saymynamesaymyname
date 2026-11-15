import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {membership, type InvitePreview, type Space, type Workspace} from './membership-api';
import {clearInvitation, invitationLink, invitationProblem, pendingInvitation} from './invitation-links';
import {isCloudActive} from './cloud';

export function JoinInvitation({onJoined}: {onJoined: () => void}) {
  const {t, i18n} = useTranslation();
  const [token, setToken] = useState(pendingInvitation);
  const [problem, setProblem] = useState(invitationProblem);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [alias, setAlias] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const cloudActive = isCloudActive();
  useEffect(() => {
    let current = true;
    if (token && cloudActive) void membership.preview(token).then(value => {
      if (current) setPreview(value);
    }).catch(() => { if (current) setProblem(true); });
    return () => { current = false; };
  }, [token, cloudActive]);
  function dismiss() { clearInvitation(); setToken(null); setProblem(false); }
  async function decide(action: 'accept' | 'decline') {
    if (!token) return;
    setBusy(true);
    try {
      await membership.action(action, {token, alias});
      dismiss(); if (action === 'accept') onJoined();
    } catch { setProblem(true); }
    finally { setBusy(false); }
  }
  if (!token && !problem) return null;
  return <section className="card invitation-review" aria-label={t('invitationReview')}>
    <h2>{t('invitationReview')}</h2>
    {problem ? <p role="alert">{t('inviteUnavailable')}</p> : !cloudActive ? <p>{t('inviteSignIn')}</p> : !preview ? <p role="status">{t('inviteLoading')}</p> : <>
      <h3>{preview.label}</h3><p>{t('currentMembers')}: {preview.members.join(', ')}</p>
      <p>{t('linkExpires', {date: new Intl.DateTimeFormat(i18n.language, {dateStyle:'medium', timeStyle:'short'}).format(new Date(preview.expires_at))})}</p>
      <p>{t('membershipPrivacy')}</p>
      <form className="form" onSubmit={e => {e.preventDefault(); void decide('accept');}}>
        <label>{t('memberAlias')}<input value={alias} required maxLength={80} disabled={busy} onChange={e => setAlias(e.target.value)}/></label>
        <label className="check-label"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/>{t('joinConsent')}</label>
        <div className="actions"><button className="primary" disabled={busy || !alias.trim() || !consent}>{t('joinRelationship')}</button><button type="button" disabled={busy} onClick={() => void decide('decline')}>{t('declineInvitation')}</button></div>
      </form>
    </>}
    {(problem || !preview) && <button disabled={busy} onClick={dismiss}>{t('dismissInvitation')}</button>}
  </section>;
}

export default function Relationships() {
  const {t} = useTranslation();
  const [workspace, setWorkspace] = useState<Workspace>({relationships:[], blocks:[]});
  const [label, setLabel] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const refresh = useCallback(async () => setWorkspace(await membership.workspace()), []);
  useEffect(() => {
    let current = true;
    void membership.workspace().then(value => { if (current) setWorkspace(value); }).catch(() => { if (current) setError(true); });
    const timer = setInterval(() => { if (!document.hidden) void membership.workspace().then(value => {if (current) setWorkspace(value);}).catch(() => {if (current) setError(true);}); }, 30000);
    return () => {current = false; clearInterval(timer);};
  }, []);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setError(false);
    try { const value = await action(); await refresh(); return value; }
    catch { setError(true); await refresh().catch(() => undefined); return undefined; }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await perform(() => membership.action('create', {label, alias}))) {setLabel(''); setAlias('');}
  }
  return <section className="page-panel membership-panel">
    <span className="eyebrow">{t('relationships')}</span><h1>{t('emptyRelationships')}</h1>
    <p>{t('membershipPrivacy')}</p><p>{t('invitationRules')}</p>
    {error && <p className="error" role="alert">{t('membershipError')}</p>}
    <div className="actions"><button disabled={busy} onClick={() => void perform(async () => undefined)}>{t('refreshMemberships')}</button>
      <label className="check-label"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/>{t('showArchived')}</label></div>
    <form className="card form" onSubmit={e => void create(e)}>
      <label>{t('relationshipLabel')}<input value={label} required maxLength={80} disabled={busy} onChange={e => setLabel(e.target.value)}/></label>
      <label>{t('memberAlias')}<input value={alias} required maxLength={80} disabled={busy} onChange={e => setAlias(e.target.value)}/></label>
      <small>{t('aliasShared')}</small><button className="primary" disabled={busy || !label.trim() || !alias.trim()}>{t('createRelationship')}</button>
    </form>
    {workspace.relationships.filter(r => showArchived || !r.mine.archived).map(space => <RelationshipCard key={space.id} space={space} busy={busy} perform={perform}/>)}
    {workspace.blocks.length > 0 && <section className="card"><h2>{t('blockedPeople')}</h2><p>{t('blockExplanation')}</p>{workspace.blocks.map(person => <div className="member-row" key={person.user_id}><span>{person.alias}</span><button disabled={busy} onClick={() => void perform(() => membership.action('block', {user_id:person.user_id, value:false}))}>{t('unblockPerson', {name:person.alias})}</button></div>)}</section>}
  </section>;
}

type Perform = (action: () => Promise<unknown>) => Promise<any>;
function RelationshipCard({space, busy, perform}: {space:Space; busy:boolean; perform:Perform}) {
  const {t, i18n} = useTranslation();
  const [email, setEmail] = useState('');
  const [alias, setAlias] = useState(space.mine.alias);
  const [links, setLinks] = useState<Record<string,string>>({});
  const [copied, setCopied] = useState('');
  const [confirmation, setConfirmation] = useState<{action:'leave'|'block'; user_id?:string; name?:string} | null>(null);
  useEffect(() => setAlias(space.mine.alias), [space.mine.alias]);
  useEffect(() => {setLinks({}); setCopied('');}, [space.membership_version]);
  const args = {relationship_id:space.id, generation:space.mine.generation};
  async function issue(id:string, version:number) {
    const value = await perform(() => membership.action('issue', {invitation_id:id, version}));
    if (value?.token) setLinks(current => ({...current, [id]:invitationLink(window.location.origin, value.token)}));
  }
  async function copy(id:string) {
    try { await navigator.clipboard.writeText(links[id]); setCopied(id); }
    catch { setCopied(''); } // Readonly field remains selectable if clipboard access is unavailable.
  }
  async function confirm() {
    if (!confirmation) return;
    const value = await perform(() => confirmation.action === 'leave' ? membership.action('leave', args) : membership.action('block', {user_id:confirmation.user_id, value:true}));
    if (value !== undefined) setConfirmation(null);
  }
  return <article className="card relationship-card" aria-label={space.label}>
    <h2>{space.label}</h2>{space.mine.archived && <span className="pill">{t('archivedRelationship')}</span>}
    <h3>{t('currentMembers')}</h3>
    <ul className="members-list">{space.members.map(person => <li className="member-row" key={person.user_id}>
      <span>{person.alias}{person.is_self ? ` · ${t('you')}` : ''}<small>{person.is_self ? '' : t(person.can_contact ? 'contactAvailable' : 'contactUnavailable')}</small></span>
      {!person.is_self && <button disabled={busy} onClick={() => person.blocked_by_me ? void perform(() => membership.action('block', {user_id:person.user_id,value:false})) : setConfirmation({action:'block',user_id:person.user_id,name:person.alias})}>{t(person.blocked_by_me ? 'unblockPerson' : 'blockPerson', {name:person.alias})}</button>}
    </li>)}</ul>
    <form className="form" onSubmit={e => {e.preventDefault(); void perform(() => membership.action('alias', {...args,alias}));}}>
      <label>{t('memberAlias')}<input value={alias} maxLength={80} required disabled={busy} onChange={e => setAlias(e.target.value)}/></label><button disabled={busy || !alias.trim()}>{t('saveAlias')}</button>
    </form>
    <h3>{t('pendingInvitations')}</h3><p>{t('linkOnly')}</p>
    <form className="form" onSubmit={e => {e.preventDefault(); void perform(() => membership.action('propose', {...args,email,membership_version:space.membership_version})).then(value => {if (value) setEmail('');});}}>
      <label>{t('inviteEmail')}<input type="email" maxLength={254} required value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label><button disabled={busy || !email.trim()}>{t('proposeInvitation')}</button>
    </form>
    {space.invitations.length === 0 && <p>{t('noPendingInvitations')}</p>}
    {space.invitations.map(invite => <section className="invitation-item" key={invite.id} aria-label={invite.email}>
      <strong>{invite.email}</strong><p>{t('approvalCount', {approved:invite.approval_count,total:invite.member_count})}</p>
      {invite.expires_at && <p>{t('linkExpires', {date:new Intl.DateTimeFormat(i18n.language, {dateStyle:'medium',timeStyle:'short'}).format(new Date(invite.expires_at))})}</p>}
      {invite.status === 'expired' ? <><p>{t('invitationExpired')}</p><button disabled={busy} onClick={() => void perform(() => membership.action('revoke', {invitation_id:invite.id}))}>{t('cancelInvitation')}</button></> : <div className="actions">
        {invite.status === 'proposed' && !invite.my_approval && <button disabled={busy} onClick={() => void perform(() => membership.action('approve',{invitation_id:invite.id}))}>{t('approveInvitation')}</button>}
        <button disabled={busy || !invite.approved} onClick={() => void issue(invite.id,invite.version)}>{t(invite.status === 'issued' ? 'replaceInviteLink' : 'createInviteLink')}</button>
        <button disabled={busy} onClick={() => void perform(() => membership.action(invite.status === 'proposed' ? 'reject' : 'revoke', {invitation_id:invite.id}))}>{t('cancelInvitation')}</button>
      </div>}
      {links[invite.id] && <div className="form"><label>{t('inviteLink')}<input readOnly value={links[invite.id]} onFocus={e => e.target.select()}/></label><button disabled={busy} onClick={() => void copy(invite.id)}>{t(copied === invite.id ? 'linkCopied' : 'copyInviteLink')}</button></div>}
    </section>)}
    <div className="actions membership-controls">
      <button disabled={busy} onClick={() => void perform(() => membership.action('archive', {...args,value:!space.mine.archived}))}>{t(space.mine.archived ? 'unarchiveRelationship' : 'archiveRelationship')}</button>
      <button disabled={busy} onClick={() => void perform(() => membership.action('mute', {...args,value:!space.mine.muted}))}>{t(space.mine.muted ? 'unmuteRelationship' : 'muteRelationship')}</button>
      <button disabled={busy} onClick={() => setConfirmation({action:'leave'})}>{t('leaveRelationship')}</button>
    </div>
    {confirmation && <Confirmation title={t(confirmation.action === 'leave' ? 'leaveRelationship' : 'blockPerson', {name:confirmation.name})}
      message={t(confirmation.action === 'leave' ? 'leaveExplanation' : 'blockExplanation')}
      button={t(confirmation.action === 'leave' ? 'confirmLeave' : 'confirmBlock')} busy={busy}
      onConfirm={() => void confirm()} onCancel={() => setConfirmation(null)}/>}
  </article>;
}

function Confirmation({title,message,button,busy,onConfirm,onCancel}: {title:string;message:string;button:string;busy:boolean;onConfirm:()=>void;onCancel:()=>void}) {
  const {t} = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {dialog.current?.showModal();}, []);
  return <dialog ref={dialog} className="confirmation" aria-label={title} onCancel={e => {e.preventDefault(); if (!busy) onCancel();}}>
    <h3>{title}</h3><p>{message}</p><div className="actions"><button disabled={busy} className="primary" onClick={onConfirm}>{button}</button><button disabled={busy} onClick={onCancel}>{t('cancelAction')}</button></div>
  </dialog>;
}
