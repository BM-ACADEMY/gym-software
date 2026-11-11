import { useEffect, useState } from 'react';
import apiClient from '../api/client';

// D-28: public site wording (pricing, landing, FAQ, help) comes live from the server so the owner can change it without a deploy.
// Each page passes its own built-in wording as the fallback, used until the server answers or if it cannot be reached.
// One fetch is shared by all pages for 60 seconds.
let cache = null; let at = 0; let pending = null;
const load = () => {
  if (cache && Date.now() - at < 60000) return Promise.resolve(cache);
  if (!pending) pending = apiClient.get('/public/site-content').then((r) => { const d = r.data && r.data.data; if (d && typeof d === 'object') { cache = d; at = Date.now(); } return cache; }).catch(() => cache).finally(() => { pending = null; });
  return pending;
};
// section: 'pricing' | 'landing' | 'faq' | 'help'. Returns the live section, or `fallback` while loading or on error.
export default function useSiteContent(section, fallback) {
  const [value, setValue] = useState(cache && cache[section] ? cache[section] : fallback);
  useEffect(() => {
    let live = true;
    load().then((c) => { if (live && c && c[section]) setValue(c[section]); });
    return () => { live = false; };
  }, [section]);
  return value;
}
