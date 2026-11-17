import { createClient } from '@supabase/supabase-js';
import i18n from './i18n';
import { cloudFailure } from './request-errors';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=url&&key?createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:false}}):null;
let active=false;
let owner: string | null = null;
let generation=0;
export function setCloudActive(value:boolean,userId?:string){active=value;owner=value?(userId??null):null;++generation;window.dispatchEvent(new Event('companion-account-change'));}
export function isCloudActive(){return active;}
export async function cloudRequest(path:string,method:string,body:unknown){
 const payload:Record<string,unknown>=body!==null&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{};
 if(!cloud)throw new Error('Cloud is not configured');
 const expectedOwner=owner; const started=generation;
 const assertCurrent=()=>{if(!active||!expectedOwner||owner!==expectedOwner||generation!==started)throw new Error('Account changed');};
 assertCurrent();
 const {data:{user},error}=await cloud.auth.getUser();if(error||!user)throw new Error('Sign in required');
 assertCurrent(); if(user.id!==expectedOwner)throw new Error('Account changed');
 const checked=async <T>(operation:()=>PromiseLike<{data:T;error:unknown}>,kind:'decision'|'other'='other'):Promise<T>=>{assertCurrent();const result=await operation();assertCurrent();if(result.error)throw cloudFailure(result.error,kind);return result.data;};
 if(path==='/refresh'){
  await checked(()=>cloud!.rpc('refresh_private_checkins'));
  const [checkins,entries,jobs]=await Promise.all([
   checked(()=>cloud!.from('companion_checkins').select('*').order('created_at',{ascending:false})),
   checked(()=>cloud!.from('companion_entries').select('id,text,locale,created_at').order('created_at',{ascending:false})),
   checked(()=>cloud!.rpc('cloud_queue',{p_action:'list',p_args:{}})),
  ]);
  return {snapshot:{checkins,jobs},entries};
 }
 if(path==='/sharing/refresh'){
  const [workspace,shares]=await Promise.all([
   checked(()=>cloud!.rpc('relationship_workspace')),
   checked(()=>cloud!.rpc('reflection_sharing',{p_action:'workspace',p_args:{}})),
  ]);
  return {workspace,shares};
 }
 if(path==='/support')return checked(()=>cloud!.rpc('support_notice',{p_action:payload.action,p_args:payload.args??{}}));
 if(path==='/cloud/schedule')return checked(()=>cloud!.rpc('cloud_schedule',{p_action:payload.action,p_args:payload.args??{}}));
 if(path==='/cloud/status')return checked(()=>cloud!.rpc('cloud_worker_status'));
 if(path==='/cloud/queue')return checked(()=>cloud!.rpc('cloud_queue',{p_action:payload.action,p_args:payload.args??{}}));
 if(path==='/ai/budget')return checked(()=>cloud!.rpc('ai_budget',{p_action:payload.action,p_args:payload.args??{}}));
 if(path==='/ai/consent')return checked(()=>cloud!.rpc('ai_consent',{p_action:payload.action,p_args:payload.args??{}}));
 if(path==='/sharing')return checked(()=>cloud!.rpc('reflection_sharing',{p_action:payload.action,p_args:payload.args??{}}));
 if(path==='/relationships/workspace')return checked(()=>cloud!.rpc('relationship_workspace'));
 if(path==='/relationships/action')return checked(()=>cloud!.rpc('relationship_action',{p_action:payload.action,p_args:payload.args}));
 if(path==='/relationships/preview')return checked(()=>cloud!.rpc('relationship_invite_preview',{p_token:payload.token}));
 if(path==='/demo/session')return {token:'cloud-session-managed-by-supabase'};
 if(path==='/preferences'){
  if(method==='PATCH')await checked(()=>cloud!.from('companion_profiles').upsert({owner:user.id,locale:payload.locale,timezone:payload.timezone}));
  let rows=await checked(()=>cloud!.from('companion_profiles').select('*').eq('owner',user.id));
  if(!rows)throw cloudFailure(null);
  if(!rows.length){await checked(()=>cloud!.from('companion_profiles').upsert({owner:user.id,locale:i18n.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},{onConflict:'owner',ignoreDuplicates:true}));rows=await checked(()=>cloud!.from('companion_profiles').select('*').eq('owner',user.id));}
  if(!rows?.length)throw cloudFailure(null);
  const schedule=await checked(()=>cloud!.rpc('cloud_schedule',{p_action:'get',p_args:{}}));
  return {...rows[0],cadence_hours:schedule.scopes.find((s:{scope:string;cadence_hours:number})=>s.scope==='')?.cadence_hours??6,quiet_start:schedule.quiet_start,quiet_end:schedule.quiet_end,daily_nudge_cap:schedule.daily_cap};
 }
 if(path==='/relationships'){
  if(method==='POST')return checked(()=>cloud!.rpc('relationship_action',{p_action:'create',p_args:{label:payload.label,alias:'Member'}}));
  return checked(()=>cloud!.from('companion_relationships').select('id,label').order('created_at'));
 }
 if(path==='/entries')return checked(()=>cloud!.from('companion_entries').select('id,text,locale,created_at').order('created_at',{ascending:false}));
 if(path==='/checkins'&&method==='GET'){
  await checked(()=>cloud!.rpc('refresh_private_checkins'));
  return {checkins:await checked(()=>cloud!.from('companion_checkins').select('*').order('created_at',{ascending:false})),jobs:[]};
 }
 if(path==='/checkins')return checked(()=>cloud!.rpc('create_private_checkin',{p_locale:i18n.language,p_prompt:i18n.t('mockPrompt'),p_draft:i18n.t('mockDraft')}));
 if(path.endsWith('/decision'))return checked(()=>cloud!.rpc('decide_private_checkin',{p_id:path.split('/')[2],p_action:payload.action,p_version:payload.version,p_text:payload.text}),'decision');
 throw new Error('Unsupported cloud operation');
}
