import {useEffect,useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {cloud,setCloudActive} from './cloud';
export default function AuthGate({children}:{children:ReactNode}){
 const {t}=useTranslation();const [screen,setScreen]=useState<'preview'|'login'|'cloud'>('preview');
 const [sessionKey,setSessionKey]=useState('preview');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function checkSession(){if(!cloud)return;const {data:{session}}=await cloud.auth.getSession();if(!session){setCloudActive(false);setScreen('preview');setSessionKey('preview');return;}const access=await cloud.rpc('has_beta_access');if(access.data===true){setCloudActive(true);setSessionKey(session.user.id);setScreen('cloud');setMessage('');}else{setCloudActive(false);setScreen('login');setMessage(t('betaPending'));}}
 useEffect(()=>{void checkSession();const subscription=cloud?.auth.onAuthStateChange(()=>{setTimeout(()=>void checkSession(),0);});return ()=>subscription?.data.subscription.unsubscribe();},[]);
 async function login(){if(!cloud)return;setBusy(true);setMessage('');const result=await cloud.auth.signInWithPassword({email,password});setPassword('');if(result.error)setMessage(t('authError'));else await checkSession();setBusy(false);}
 async function logout(){await cloud?.auth.signOut();setCloudActive(false);setScreen('preview');}
 if(screen==='login')return <main style={{margin:'auto',maxWidth:600}}><h1>{t('cloudAccount')}</h1><p>{t('cloudSetup')}</p><form className="card form" onSubmit={e=>{e.preventDefault();void login();}}><label>{t('email')}<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>{t('password')}<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{t('signIn')}</button><button type="button" onClick={()=>setScreen('preview')}>{t('localPreview')}</button><p role="status">{message}</p></form></main>;
 return <><div style={{padding:'8px 4%',display:'flex',justifyContent:'space-between',gap:12}}><span>{screen==='cloud'?t('cloudMode'):t('localPreview')}</span>{cloud&&<button onClick={()=>screen==='cloud'?void logout():setScreen('login')}>{t(screen==='cloud'?'signOut':'cloudAccount')}</button>}</div><div key={screen+sessionKey}>{children}</div></>;
}
