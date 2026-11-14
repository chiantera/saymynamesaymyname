import { readSetting,saveSetting,resolveLocale } from './domain';
import i18n from './i18n';
const key='browser-preview';
function load(){ return JSON.parse(readSetting(key) ?? '{"prefs":null,"relationships":[],"checkins":[],"entries":[]}'); }
function save(s:any){ saveSetting(key,JSON.stringify(s)); }
export async function browserPreview(path:string,method:string,body:any){
 const s=load(); const now=Date.now();
 s.prefs ??= {locale:resolveLocale(i18n.language),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,cadence_hours:6,quiet_start:'22:00',quiet_end:'08:00',daily_nudge_cap:3};
 for(const c of s.checkins){if(c.status==='pending'&&Date.parse(c.deadline)<=now){c.status='skipped';c.version++;} if(c.status==='deferred'&&Date.parse(c.snoozed_until)<=now){c.status='pending';c.version++;c.deadline=new Date(now+1800000).toISOString();}}
 let result:any;
 if(path==='/demo/session')result={token:'fictional-browser-only'};
 else if(path==='/preferences'){if(method==='PATCH')Object.assign(s.prefs,body);result=s.prefs;}
 else if(path==='/relationships'){if(method==='POST'){result={id:crypto.randomUUID(),label:body.label};s.relationships.push(result);}else result=s.relationships;}
 else if(path==='/entries')result=s.entries;
 else if(path==='/checkins'&&method==='GET')result={checkins:s.checkins,jobs:[]};
 else if(path==='/checkins'){
  if(s.checkins.some((c:any)=>['pending','deferred'].includes(c.status)))throw new Error('Pending check-in');
  const id=crypto.randomUUID();s.checkins.unshift({id,status:'pending',version:0,prompt:i18n.t('mockPrompt'),draft:i18n.t('mockDraft'),deadline:new Date(now+1800000).toISOString(),created_at:new Date().toISOString()});result={id};
 }else if(path.endsWith('/decision')){
  const c=s.checkins.find((c:any)=>c.id===path.split('/')[2]);if(!c||c.status!=='pending'||c.version!==body.version)throw new Error('Stale decision');
  c.status=body.action==='approve'?'fulfilled':body.action==='skip'?'skipped':'deferred';c.version++;
  if(body.action==='approve'){if(!body.text.trim())throw new Error('Empty text');s.entries.unshift({id:crypto.randomUUID(),text:body.text,locale:s.prefs.locale,created_at:new Date().toISOString()});}
  if(body.action==='snooze')c.snoozed_until=new Date(now+3600000).toISOString();result={status:c.status};
 }else throw new Error('Unsupported preview action');
 save(s); return result;
}
