import {useCallback,useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {cloudRequest} from './cloud';
import {membership,type Workspace} from './membership-api';
import type {Entry} from './api';
type Sent={id:string;entry_id:string;recipients:{user_id:string;alias:string;revoked:boolean}[]};
type Received={id:string;alias:string;created_at:string};
type Shares={sent:Sent[];received:Received[]};
const action=(name:string,args:Record<string,unknown>={})=>cloudRequest('/sharing','POST',{action:name,args});
export default function Sharing({entries}:{entries:Entry[]}){
 const {t}=useTranslation();
 const [spaces,setSpaces]=useState<Workspace>({relationships:[],blocks:[]});
 const [shares,setShares]=useState<Shares>({sent:[],received:[]});
 const [entryId,setEntry]=useState(''); const [spaceId,setSpace]=useState('');
 const [recipients,setRecipients]=useState<string[]>([]); const [review,setReview]=useState(false);
 const [busy,setBusy]=useState(false); const [error,setError]=useState(false);
 const [opened,setOpened]=useState<{id:string;text:string}|null>(null);
 const currentSpace=useRef(spaceId);currentSpace.current=spaceId;
 const sequence=useRef(0); const dialog=useRef<HTMLDialogElement>(null);
 const selected=spaces.relationships.find(s=>s.id===spaceId);
 const eligible=selected?.members.filter(m=>m.can_contact&&!m.is_self)??[];
 const refresh=useCallback(async()=>{
  const n=++sequence.current; setOpened(null);setReview(false);dialog.current?.close();
  try{const [w,s]=await Promise.all([membership.workspace(),action('workspace')]);
   if(n===sequence.current){setSpaces(w);setShares(s);
    // A completed background refresh must not erase a still-valid selection.
    const available=w.relationships.find(space=>space.id===currentSpace.current)?.members??[];
    setRecipients(prev=>prev.filter(id=>available.some(m=>m.user_id===id&&m.can_contact&&!m.is_self)));
    setError(false);}
  }catch{if(n===sequence.current){setSpaces({relationships:[],blocks:[]});setShares({sent:[],received:[]});setRecipients([]);setError(true);}}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);
  const hide=()=>{++sequence.current;setOpened(null);setReview(false);dialog.current?.close();if(!document.hidden)void refresh();};
  document.addEventListener('visibilitychange',hide);
  return()=>{++sequence.current;clearInterval(timer);document.removeEventListener('visibilitychange',hide);};
 },[refresh]);
 async function mutate(name:string,args:Record<string,unknown>){
  setBusy(true);setError(false);setReview(false);dialog.current?.close();
  try{await action(name,args);await refresh();}catch{setOpened(null);setError(true);}finally{setBusy(false);}
 }
 async function read(id:string){
  const n=++sequence.current;setOpened(null);setBusy(true);setError(false);
  try{const value=await action('read',{share_id:id});if(n===sequence.current)setOpened(value);}
  catch{if(n===sequence.current)setError(true);}finally{setBusy(false);}
 }
 return <section className="card sharing" aria-label={t('sharingTitle')}>
  <h2>{t('sharingTitle')}</h2><p>{t('sharingPolicy')}</p>
  <button disabled={busy} onClick={()=>void refresh()}>{t('sharingRefresh')}</button>
  {error&&<p role="alert">{t('sharingError')}</p>}
  <form className="form" onSubmit={e=>{e.preventDefault();setReview(true);dialog.current?.showModal();}}>
   <label>{t('sharingReflection')}<select aria-label={t('sharingReflection')} required value={entryId} onChange={e=>{setEntry(e.target.value);setReview(false);}}><option value="">—</option>{entries.map(e=><option key={e.id} value={e.id}>{e.text.slice(0,65)}</option>)}</select></label>
   <label>{t('relationships')}<select aria-label={t('relationships')} required value={spaceId} onChange={e=>{setSpace(e.target.value);setRecipients([]);setReview(false);}}><option value="">—</option>{spaces.relationships.filter(s=>!s.mine.archived&&!s.mine.muted).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <fieldset><legend>{t('sharingRecipients')}</legend>{eligible.length===0&&<p>{t('sharingNoRecipients')}</p>}{eligible.map(m=><label className="check-label" key={m.user_id}><input type="checkbox" checked={recipients.includes(m.user_id)} onChange={e=>{setReview(false);setRecipients(prev=>e.target.checked?[...prev,m.user_id]:prev.filter(id=>id!==m.user_id));}}/>{m.alias}</label>)}</fieldset>
   <button disabled={busy||!entryId||!selected||recipients.length===0}>{t('sharingReview')}</button>
  </form>
  <dialog className="confirmation" ref={dialog} aria-label={t('sharingReview')} onCancel={()=>setReview(false)}>
   {review&&<><h3>{t('sharingReview')}</h3><p>{entries.find(e=>e.id===entryId)?.text}</p><p>{t('sharingRecipients')}: {eligible.filter(m=>recipients.includes(m.user_id)).map(m=>m.alias).join(', ')}</p><p>{t('sharingPolicy')}</p>
    <button disabled={busy} onClick={()=>void mutate('share',{entry_id:entryId,relationship_id:spaceId,membership_version:selected?.membership_version,recipients})}>{t('sharingConfirm')}</button>
    <button onClick={()=>{dialog.current?.close();setReview(false);}}>{t('cancelAction')}</button></>}
  </dialog>
  <h3>{t('sharingSent')}</h3>{shares.sent.map(s=><article key={s.id}><small>{t('sharingReflection')}: {entries.find(e=>e.id===s.entry_id)?.text.slice(0,65)}</small>{s.recipients.map(r=><p key={r.user_id}>{r.alias} · {t(r.revoked?'sharingRevoked':'sharingReadOnly')} {!r.revoked&&<button disabled={busy} onClick={()=>void mutate('revoke',{share_id:s.id,recipient:r.user_id})}>{t('sharingRevoke')}</button>}</p>)}</article>)}
  <h3>{t('sharingReceived')}</h3>{shares.received.length===0&&<p>{t('sharingEmpty')}</p>}{shares.received.map(s=><article key={s.id}><p>{s.alias} · {t('sharingReadOnly')}</p><button disabled={busy} onClick={()=>void read(s.id)}>{t('sharingOpen')}</button>{opened?.id===s.id&&<p className="received-text">{opened.text}</p>}</article>)}
 </section>;
}
