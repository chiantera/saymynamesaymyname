import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {cloudRequest} from './cloud';
type Attempt={id:string;created_at:string;state:string;provider:string;model:string;reserved_eur:number;estimated_eur:number|null;actual_eur:number|null};
type Summary={revision:number;monthly_eur:number;paused:boolean;live_enabled:boolean;month:string;posted_eur:number;held_eur:number;unknown_eur:number;remaining_eur:number;alert:string;last_reconciled_at:string|null;attempts:Attempt[]};
const request=(action:string,args:Record<string,unknown>={})=>cloudRequest('/ai/budget','POST',{action,args}) as Promise<Summary>;
export default function Budget(){
 const {t,i18n}=useTranslation();const [data,setData]=useState<Summary|null>(null);const [limit,setLimit]=useState('20');const [paused,setPaused]=useState(false);const [busy,setBusy]=useState(true);const [error,setError]=useState(false);
 const money=(amount:number)=>new Intl.NumberFormat(i18n.language,{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:6}).format(amount);
 const date=(value:string)=>new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value));
 function accept(value:Summary){setData(value);setLimit(String(value.monthly_eur));setPaused(value.paused);}
 async function refresh(){setBusy(true);setError(false);try{accept(await request('get'));}catch{setData(null);setError(true);}finally{setBusy(false);}}
 useEffect(()=>{void refresh();},[]);
 async function save(){if(!data)return;setBusy(true);setError(false);try{accept(await request('save',{revision:data.revision,monthly_eur:limit,paused}));}catch{setData(null);setError(true);}finally{setBusy(false);}}
 return <section className="card form" aria-label={t('budgetTitle')}><h2>{t('budgetTitle')}</h2><p>{t('budgetNotice')}</p><button disabled={busy} onClick={()=>void refresh()}>{t('sharingRefresh')}</button>{error&&<p role="alert">{t('sharingError')}</p>}
 {data&&<><p>{t('budgetPeriod')}: {data.month}</p><dl><dt>{t('budgetPosted')}</dt><dd>{money(data.posted_eur)}</dd><dt>{t('budgetHeld')}</dt><dd>{money(data.held_eur)}</dd><dt>{t('budgetUnknown')}</dt><dd>{money(data.unknown_eur)}</dd><dt>{t('budgetRemaining')}</dt><dd>{money(data.remaining_eur)}</dd></dl>
 {data.alert!=='none'&&<p role="status">{t('budgetAlert',{level:data.alert})}</p>}
 <p>{t('budgetLastReconciled')}: {data.last_reconciled_at?date(data.last_reconciled_at):t('budgetNoReconciliation')}</p>
 <form className="form" onSubmit={e=>{e.preventDefault();void save();}}><label>{t('budgetPersonalLimit')}<input type="number" min={0} max={20} step="0.000001" required value={limit} disabled={busy} onChange={e=>setLimit(e.target.value)}/></label><label className="check-label"><input type="checkbox" checked={paused} disabled={busy} onChange={e=>setPaused(e.target.checked)}/>{t('budgetPause')}</label><button disabled={busy}>{t('save')}</button></form>
 <h3>{t('budgetLedger')}</h3>{data.attempts.length===0&&<p>{t('budgetEmpty')}</p>}{data.attempts.map(a=><article key={a.id}><p>{a.provider} · {a.model}</p><p>{t('budgetState_'+a.state)} · {money(a.actual_eur??a.estimated_eur??(a.state==='cancelled'?0:a.reserved_eur))}</p><small>{date(a.created_at)} UTC</small></article>)}</>}
 </section>;
}
