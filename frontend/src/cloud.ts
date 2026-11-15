import { createClient } from '@supabase/supabase-js';
import i18n from './i18n';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=url&&key?createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:false}}):null;
let active=false;
let owner: string | null = null;
let generation=0;
export function setCloudActive(value:boolean,userId?:string){active=value;owner=value?(userId??null):null;++generation;}
export function isCloudActive(){return active;}
export async function cloudRequest(path:string,method:string,body:any){
 if(!cloud)throw new Error('Cloud is not configured');
 const expectedOwner=owner; const started=generation;
 const assertCurrent=()=>{if(!active||!expectedOwner||owner!==expectedOwner||generation!==started)throw new Error('Account changed');};
 assertCurrent();
 const {data:{user},error}=await cloud.auth.getUser();if(error||!user)throw new Error('Sign in required');
 assertCurrent(); if(user.id!==expectedOwner)throw new Error('Account changed');
 const checked=async (operation:()=>PromiseLike<any>)=>{assertCurrent();const result=await operation();assertCurrent();if(result.error)throw new Error('Cloud request failed');return result.data;};
 if(path==='/relationships/workspace')return checked(()=>cloud!.rpc('relationship_workspace'));
 if(path==='/relationships/action')return checked(()=>cloud!.rpc('relationship_action',{p_action:body.action,p_args:body.args}));
 if(path==='/relationships/preview')return checked(()=>cloud!.rpc('relationship_invite_preview',{p_token:body.token}));
 if(path==='/demo/session')return {token:'cloud-session-managed-by-supabase'};
 if(path==='/preferences'){
  if(method==='PATCH')await checked(()=>cloud!.from('companion_profiles').upsert({owner:user.id,locale:body.locale,timezone:body.timezone}));
  let rows=await checked(()=>cloud!.from('companion_profiles').select('*').eq('owner',user.id));
  if(!rows.length){await checked(()=>cloud!.from('companion_profiles').upsert({owner:user.id,locale:i18n.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},{onConflict:'owner',ignoreDuplicates:true}));rows=await checked(()=>cloud!.from('companion_profiles').select('*').eq('owner',user.id));}
  return {...rows[0],cadence_hours:6,quiet_start:'22:00',quiet_end:'08:00',daily_nudge_cap:3};
 }
 if(path==='/relationships'){
  if(method==='POST')return checked(()=>cloud!.rpc('relationship_action',{p_action:'create',p_args:{label:body.label,alias:'Member'}}));
  return checked(()=>cloud!.from('companion_relationships').select('id,label').order('created_at'));
 }
 if(path==='/entries')return checked(()=>cloud!.from('companion_entries').select('id,text,locale,created_at').order('created_at',{ascending:false}));
 if(path==='/checkins'&&method==='GET'){
  await checked(()=>cloud!.rpc('refresh_private_checkins'));
  return {checkins:await checked(()=>cloud!.from('companion_checkins').select('*').order('created_at',{ascending:false})),jobs:[]};
 }
 if(path==='/checkins')return checked(()=>cloud!.rpc('create_private_checkin',{p_locale:i18n.language,p_prompt:i18n.t('mockPrompt'),p_draft:i18n.t('mockDraft')}));
 if(path.endsWith('/decision'))return checked(()=>cloud!.rpc('decide_private_checkin',{p_id:path.split('/')[2],p_action:body.action,p_version:body.version,p_text:body.text}));
 throw new Error('Unsupported cloud operation');
}
