import { createContext, createElement, useContext } from 'react';
import { uiText } from './schema.js';
// The panel's own words (Add, Save...) in the chosen language, English when a word is missing. Draft Tamil and Hindi need native review (M-06).
const LangContext = createContext('en');
export const LangProvider = ({ lang, children }) => createElement(LangContext.Provider, { value: lang || 'en' }, children);
export const useT = () => { const lang = useContext(LangContext); return (key) => uiText(lang, key); };
