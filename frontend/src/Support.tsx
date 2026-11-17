/* Available independently of auth/API/AI. No resource lookup leaves this device. */
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Notice } from './ui';
import { cloudRequest, isCloudActive } from './cloud';
import { countries, directories, emergencyResources, quickExitURL, supportPathKey, validSupportKind, type SupportKind } from './support-resources';

const Help = createContext<(kind?: SupportKind) => void>(() => {});
export function SupportProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState('');
  const [kind, setKind] = useState<SupportKind>('manual');
  const [generated, setGenerated] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const title = useId();
  const resources = emergencyResources(country);
  const names = new Intl.DisplayNames([i18n.language === 'yue-Hant' ? 'zh-Hant' : i18n.language], { type: 'region' });
  function close() { setOpen(false); setCountry(''); setKind('manual'); setGenerated(false); }
  useEffect(() => {
    if (!open || !dialog.current) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current.showModal();
    return () => { dialog.current?.close(); if (opener.current?.isConnected) opener.current.focus(); };
  }, [open]);
  // Account changes/logout must remove any previously revealed private category.
  useEffect(() => {
    const reset = () => close();
    window.addEventListener('companion-account-change', reset);
    return () => window.removeEventListener('companion-account-change', reset);
  }, []);
  const exit = () => window.location.replace(quickExitURL);
  return <Help.Provider value={(value = 'manual') => { setKind(value); setGenerated(value !== 'manual'); setOpen(true); }}>
    {children}
    <aside className="support-controls" aria-label={t('supportTools')}>
      <Button onClick={() => { setKind('manual'); setGenerated(false); setOpen(true); }}>{t('supportOpen')}</Button>
      <Button onClick={exit}>{t('supportExit')}</Button>
    </aside>
    <dialog ref={dialog} className="dialog support-dialog" aria-labelledby={title}
      onCancel={event => { event.preventDefault(); close(); }}>
      {open && <>
        <div className="section__head support-dialog__head"><h2 id={title}>{t('supportTitle')}</h2><div className="section__actions"><Button onClick={exit}>{t('supportExit')}</Button><Button onClick={close}>{t('supportClose')}</Button></div></div>
        <p>{t('supportDanger')}</p>
        <Field label={t('supportCountry')} hint={t('supportCountryHint')}><select value={country} onChange={e => setCountry(e.target.value)}>
          <option value="">{t('supportUnknown')}</option>
          {countries.map(code => <option key={code} value={code}>{names.of(code)}</option>)}
        </select></Field>
        {!resources.services.length && <p>{t(resources.stale ? 'supportStale' : 'supportNoNumber')}</p>}
        <ul className="support-links">{resources.services.map(service => <li key={service.kind}>
          <a href={`tel:${service.number}`}>{t(`supportService_${service.kind}`)}: {service.number}</a>
        </li>)}</ul>
        {resources.source && <p className="field__hint">{t('supportVerified', { date: resources.verified })} · <a href={resources.source} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t('supportSource')}</a></p>}
        {generated && <Notice><p>{t('supportWithheldDetail')}</p></Notice>}
        <Field label={t('supportTopic')}><select value={kind} onChange={e => setKind(validSupportKind(e.target.value))}>
          {(['manual', 'self_harm', 'violence', 'stalking'] as const).map(value => <option key={value} value={value}>{t(`supportTopic_${value}`)}</option>)}
          {(kind === 'refuse' || kind === 'unavailable') && <option value={kind}>{t('supportTopic_manual')}</option>}
        </select></Field>
        <p>{t(supportPathKey(kind, i18n.language))}</p>
        <p>{t('supportLimits')}</p>
        <h3>{t('supportDirectories')}</h3>
        <p>{t('supportExternal')}</p>
        <ul className="support-links">{directories.map(item => <li key={item.id}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t(`supportDirectory_${item.id}`)}</a>
        </li>)}</ul>
        <p>{t('supportCare')}</p>
        <Notice><p>{t('supportDevice')}</p></Notice>
        <div className="dialog__actions"><Button onClick={close}>{t('supportClose')}</Button></div>
      </>}
    </dialog>
  </Help.Provider>;
}

export function SupportNotices() {
  const { t } = useTranslation();
  const help = useContext(Help);
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const sequence = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    async function refresh() {
      const current = ++sequence.current;
      try {
        const data = await cloudRequest('/support', 'POST', { action: 'peek' });
        if (alive && current === sequence.current) setId(data.id);
      } catch { /* Offline help remains available; do not expose RPC errors. */ }
    }
    if (!isCloudActive()) return;
    void refresh(); const timer = window.setInterval(() => void refresh(), 30000);
    return () => { alive = false; mounted.current = false; ++sequence.current; window.clearInterval(timer); };
  }, []);
  async function action(reveal: boolean) {
    if (!id || busy) return;
    ++sequence.current;
    setBusy(true); setError(false);
    try {
      const data = await cloudRequest('/support', 'POST', { action: reveal ? 'reveal' : 'dismiss', args: { id } });
      if (!mounted.current) return;
      ++sequence.current; // An older peek must not resurrect a dismissed notice.
      if (reveal && data.id) help(validSupportKind(data.kind));
      if (!reveal || !data.id) setId(null);
    } catch { if (mounted.current) setError(true); } finally { if (mounted.current) setBusy(false); }
  }
  if (!id) return null;
  return <Notice actions={<><Button disabled={busy} onClick={() => void action(true)}>{t('supportReview')}</Button><Button disabled={busy} onClick={() => void action(false)}>{t('supportDismiss')}</Button></>}>
    <p>{t('supportWithheld')}</p>{error && <p role="status">{t('supportNoticeError')}</p>}
  </Notice>;
}
