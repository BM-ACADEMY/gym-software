import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useT } from '../../i18n';

// PWA-01 follow-up: tells the owner how to put GymDesk on the phone home screen. Hidden once installed or dismissed.
const KEY = 'gymdesk_install_hint_off';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const InstallHint = () => {
  const { t } = useT();
  const [off, setOff] = useState(read());
  const [evt, setEvt] = useState(null);
  const installed = typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
  useEffect(() => { const h = (e) => { e.preventDefault(); setEvt(e); }; window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h); }, []);
  if (off || installed) return null;
  const hide = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setOff(true); };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  return (
    <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{t('Put GymDesk on your phone')}</p>
        <p className="mt-1 text-xs">{ios ? t('On iPhone: tap Share, then Add to Home Screen.') : t('On Android: tap the browser menu, then Install app or Add to Home screen.')}</p>
        {evt ? <button type="button" onClick={async () => { try { await evt.prompt(); } catch { /* ignore */ } setEvt(null); }} className="mt-2 rounded-lg bg-teal-600 px-3 py-1 text-xs font-medium text-white">{t('Install now')}</button> : null}
      </div>
      <button type="button" onClick={hide} className="text-xs text-teal-700 hover:underline">{t('Hide')}</button>
    </div>
  );
};
export default InstallHint;
