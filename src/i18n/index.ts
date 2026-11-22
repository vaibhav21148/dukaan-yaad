import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import gu from './gu.json';
import hi from './hi.json';
import mr from './mr.json';

// Hindi UI copy is Hinglish (Roman script), as in the prototype.
// Marathi and Gujarati are in native script: DRAFT translations, flagged for native-speaker review.
void i18n.use(initReactI18next).init({
  resources: { hi: { translation: hi }, en: { translation: en }, mr: { translation: mr }, gu: { translation: gu } },
  lng: 'hi',
  fallbackLng: 'hi',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const LANG_NAMES: Record<string, string> = { hi: 'Hindi / Hinglish', en: 'English', mr: 'मराठी', gu: 'ગુજરાતી' };
export const HTML_LANG: Record<string, string> = { hi: 'hi-Latn', en: 'en-IN', mr: 'mr', gu: 'gu' };
export default i18n;
