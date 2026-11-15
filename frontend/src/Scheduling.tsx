import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {cloudRequest} from './cloud';
import {membership,type Workspace} from './membership-api';
type Config={revision:number;paused:boolean;paused_until:string|null;quiet_start:string;quiet_end:string;daily_cap:number;scopes:{scope:string;enabled:boolean;cadence_hours:number}[]};
const request=(path:string,action:string,args:Record<string,unknown>={})=>cloudRequest('/cloud/'+path,'POST',{action,args});
export default function Scheduling(){
 const {t}=useTranslation();const [config,setConfig]=useState<Config|null>(null);const [spaces,setSpaces]=useState<Workspace>({relationships:[],blocks:[]});
 const [scope,setScope]=useState('');const [enabled,setEnabled]=useState(false);const [cadence,setCadence]=useState(6);
 const [ready,setReady]=useState(false);const [jobs,setJobs]=useState<{id:string;status:string}[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 async function refresh(){setBusy(true);setError(false);try{
  const [c,w,status,j]=await Promise.all([request('schedule','get'),membership.workspace(),request('status','get'),request('queue','list')]);
  setConfig(c);setSpaces(w);setReady(status.ready);setJobs(j);
  const selected=c.scopes.find((s:Config['scopes'][number])=>s.scope===scope);setEnabled(selected?.enabled??false);setCadence(selected?.cadence_hours??6);
 }catch{setError(true);setReady(false);}finally{setBusy(false);}}
 useEffect(()=>{void refresh();},[]);
 async function act(operation:()=>Promise<unknown>){setBusy(true);setError(false);try{await operation();await refresh();}catch{setError(true);}finally{setBusy(false);}}
 return <section className="card form" aria-label={t('scheduleTitle')}><h2>{t('scheduleTitle')}</h2><p role="status">{t(ready?'workerReady':'workerUnavailable')}</p><p>{t('scheduleNotice')}</p>
 <button disabled={busy} onClick={()=>void refresh()}>{t('sharingRefresh')}</button>{error&&<p role="alert">{t('sharingError')}</p>}
 {config&&<form className="form" onSubmit={e=>{e.preventDefault();void act(()=>request('schedule','save',{...config,scope,enabled,cadence_hours:cadence}));}}>
 <label>{t('relationships')}<select aria-label={t('relationships')} value={scope} disabled={busy} onChange={e=>{const value=e.target.value;setScope(value);const s=config.scopes.find(s=>s.scope===value);setEnabled(s?.enabled??false);setCadence(s?.cadence_hours??6);}}><option value="">{t('solo')}</option>{spaces.relationships.filter(s=>!s.mine.archived&&!s.mine.muted).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 <label className="check-label"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)}/>{t('scheduleEnabled')}</label>
 <label>{t('cadence')}<input type="number" min={3} max={12} required value={cadence} disabled={busy} onChange={e=>setCadence(Number(e.target.value))}/></label>
 <label>{t('quietHours')}<input aria-label={t('quietStart')} type="time" required value={config.quiet_start} disabled={busy} onChange={e=>setConfig({...config,quiet_start:e.target.value})}/><input aria-label={t('quietEnd')} type="time" required value={config.quiet_end} disabled={busy} onChange={e=>setConfig({...config,quiet_end:e.target.value})}/></label>
 <label>{t('nudgeCap')}<input type="number" min={1} max={20} required value={config.daily_cap} disabled={busy} onChange={e=>setConfig({...config,daily_cap:Number(e.target.value)})}/></label>
 <label className="check-label"><input type="checkbox" checked={config.paused} disabled={busy} onChange={e=>setConfig({...config,paused:e.target.checked})}/>{t('schedulePaused')}</label>
 <button disabled={busy}>{t('save')}</button></form>}
 <h3>{t('cloudJobs')}</h3><button disabled={busy||!ready} onClick={()=>void act(()=>request('queue','enqueue',{request_id:crypto.randomUUID(),relationship_id:scope||null}))}>{t('queueCheckin')}</button>
 {jobs.map(job=><p key={job.id}>{t(job.status==='done'?'draftReady':job.status==='processing'?'working':job.status)} {['queued','processing'].includes(job.status)&&<button disabled={busy} onClick={()=>void act(()=>request('queue','cancel',{id:job.id}))}>{t('cancelAction')}</button>}</p>)}
 </section>;
}
