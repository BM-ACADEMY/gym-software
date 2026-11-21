import { useSyncExternalStore } from 'react';
import ta from './ta';
import hi from './hi';

// Tiny dependency-free i18n. English text IS the key, so any screen can be
// translated one string at a time: t('Members'). Missing translation falls
// back to the English text, so nothing ever shows a raw key.
// Variables: t('Trial ends in {n} days', { n: 3 }).

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
];
const DICTS = { en: {}, ta, hi };
const STORAGE_KEY = 'gymdesk_lang';

const read = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return DICTS[v] ? v : 'en';
  } catch { return 'en'; }
};

let current = read();
const listeners = new Set();

export const getLanguage = () => current;
export const setLanguage = (code) => {
  if (!DICTS[code]) return;
  current = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
  listeners.forEach((l) => l());
};
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

export const translate = (text, vars, lang = current) => {
  let out = (DICTS[lang] && DICTS[lang][text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return out;
};

// React hook: re-renders when the language changes.
export const useT = () => {
  const lang = useSyncExternalStore(subscribe, getLanguage, () => 'en');
  return { t: (text, vars) => translate(text, vars, lang), lang, setLanguage };
};
