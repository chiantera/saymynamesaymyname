import { createClient } from '@supabase/supabase-js';
import i18n from './i18n';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=url&&key?createClient(url,key,{auth:{flowType:'pkce'}}):null;
let active=false;
export function setCloudActive(value:boolean){active=value;}
export function isCloudActive(){return active;}
export async function cloudRequest(path:string,method:string,body:any){
 if(!cloud)throw new Error('Cloud is not configured');
 const {data:{user},error}=await cloud.auth.getUser();if(error||!user)throw new Error('Sign in required');
 const checked=async (result:any)=>{if(result.error)throw new Error('Cloud request failed');return result.data;};
 if(path==='/demo/session')return {token:'cloud-session-managed-by-supabase'};
 if(path==='/preferences'){
  if(method==='PATCH')await checked(await cloud.from('companion_profiles').upsert({owner:user.id,...body}));
  let rows=await checked(await cloud.from('companion_profiles').select('*').eq('owner',user.id));
  if(!rows.length){await checked(await cloud.from('companion_profiles').insert({owner:user.id,locale:i18n.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}));rows=await checked(await cloud.from('companion_profiles').select('*').eq('owner',user.id));}
  return {...rows[0],cadence_hours:6,quiet_start:'22:00',quiet_end:'08:00',daily_nudge_cap:3};
 }
 if(path==='/relationships'){
  if(method==='POST')return (await checked(await cloud.from('companion_relationships').insert({owner:user.id,label:body.label}).select()))[0];
  return checked(await cloud.from('companion_relationships').select('id,label').order('created_at'));
 }
 if(path==='/entries')return checked(await cloud.from('companion_entries').select('id,text,locale,created_at').order('created_at',{ascending:false}));
 if(path==='/checkins'&&method==='GET'){
  await checked(await cloud.rpc('refresh_private_checkins'));
  return {checkins:await checked(await cloud.from('companion_checkins').select('*').order('created_at',{ascending:false})),jobs:[]};
 }
 if(path==='/checkins')return checked(await cloud.rpc('create_private_checkin',{p_locale:i18n.language,p_prompt:i18n.t('mockPrompt'),p_draft:i18n.t('mockDraft')}));
 if(path.endsWith('/decision'))return checked(await cloud.rpc('decide_private_checkin',{p_id:path.split('/')[2],p_action:body.action,p_version:body.version,p_text:body.text}));
 throw new Error('Unsupported cloud operation');
}
