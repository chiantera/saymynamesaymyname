import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {cloudRequest} from './cloud';
import type {Entry} from './api';
type Provider={provider:string;capability:string;enabled:boolean;can_approve:boolean;approved:boolean;allow_fallback:boolean;review_revision:string|null;policy_url:string|null};
type Consent={revision:number;journals:boolean;documents:boolean;chats:boolean;exclusions:string[];providers:Provider[]};
const request=(action:string,args:Record<string,unknown>={})=>cloudRequest('/ai/consent','POST',{action,args}) as Promise<Consent>;
const names:Record<string,string>={deepseek:'DeepSeek',anthropic:'Anthropic',mistral:'Mistral',groq:'Groq'};
export default function AIConsent({entries}:{entries:Entry[]}){
 const {t}=useTranslation();const [config,setConfig]=useState<Consent|null>(null);const [busy,setBusy]=useState(true);const [error,setError]=useState(false);
 async function refresh(){setBusy(true);setError(false);try{setConfig(await request('get'));}catch{setConfig(null);setError(true);}finally{setBusy(false);}}
 useEffect(()=>{void refresh();},[]);
 async function change(action:string,args:Record<string,unknown>){if(!config)return;setBusy(true);setError(false);try{setConfig(await request(action,{...args,revision:config.revision}));}catch{setError(true);setConfig(null);}finally{setBusy(false);}}
 return <section className="card form" aria-label={t('aiConsentTitle')}><h2>{t('aiConsentTitle')}</h2><p>{t('aiConsentNotice')}</p><button disabled={busy} onClick={()=>void refresh()}>{t('sharingRefresh')}</button>
 {error&&<p role="alert">{t('sharingError')}</p>}
 {config&&<><fieldset><legend>{t('aiSavedContext')}</legend>
 <label className="check-label"><input type="checkbox" checked={config.journals} disabled={busy} onChange={e=>void change('context',{journals:e.target.checked,documents:false,chats:false})}/>{t('aiJournals')}</label>
 <label className="check-label"><input type="checkbox" checked={false} disabled/>{t('aiDocuments')}</label>
 <label className="check-label"><input type="checkbox" checked={false} disabled/>{t('aiChats')}</label><small>{t('aiSourcesLater')}</small>
 </fieldset><h3>{t('aiExclusions')}</h3>{entries.length===0&&<p>{t('emptyEntries')}</p>}{entries.map(entry=><label className="check-label" key={entry.id}><input type="checkbox" disabled={busy} checked={config.exclusions.includes(entry.id)} onChange={e=>void change('exclusion',{entry_id:entry.id,excluded:e.target.checked})}/><span>{t('aiExcludeItem')}: {entry.text.slice(0,100)}</span></label>)}
 <h3>{t('aiProviders')}</h3>{config.providers.map(provider=><article key={provider.provider+provider.capability}><h4>{names[provider.provider]??provider.provider} · {t('aiCapability_'+provider.capability)}</h4>
 {!provider.can_approve&&<p>{t('aiReviewPending')}</p>}{provider.policy_url?.startsWith('https://')&&<a href={provider.policy_url} target="_blank" rel="noreferrer">{t('aiPolicy')}</a>}
 <label className="check-label"><input type="checkbox" disabled={busy||(!provider.can_approve&&!provider.approved)} checked={provider.approved} onChange={e=>void change('provider',{provider:provider.provider,capability:provider.capability,review_revision:provider.review_revision,approved:e.target.checked,allow_fallback:false})}/>{t('aiApproveProvider')}</label>
 <label className="check-label"><input type="checkbox" disabled={busy||!provider.approved} checked={provider.allow_fallback} onChange={e=>void change('provider',{provider:provider.provider,capability:provider.capability,review_revision:provider.review_revision,approved:true,allow_fallback:e.target.checked})}/>{t('aiFallback')}</label>
 </article>)}</>}
 </section>;
}
