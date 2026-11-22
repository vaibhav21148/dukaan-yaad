// Short doubt questions shown on yellow cards. Shared by the offline parser and
// the server-side never-invent guard, so both speak the owner's language.
import type { Lang } from './types.js';

export type DoubtKey =
  | 'howMuchDue'
  | 'howMuchPaid'
  | 'howMuchCredit'
  | 'howMuchReceived'
  | 'amountNotHeard'
  | 'whoName'
  | 'nameNotHeard'
  | 'dateNotHeard'
  | 'itemNotHeard'
  | 'notUnderstood'
  | 'whichParty'
  | 'whatItem'
  | 'newPerson';

const M: Record<Lang, Record<DoubtKey, string>> = {
  hi: {
    howMuchDue: 'Kitna dena hai?',
    howMuchPaid: 'Kitna diya?',
    howMuchCredit: 'Kitna udhaar?',
    howMuchReceived: 'Kitne paise mile?',
    amountNotHeard: 'Rakam note mein saaf nahi suni. Kitna?',
    whoName: 'Kiska naam hai?',
    nameNotHeard: 'Yeh naam note mein nahi suna. Kaun?',
    dateNotHeard: 'Date note mein nahi suni. Kab tak?',
    itemNotHeard: 'Saamaan ka naam saaf nahi suna. Kya?',
    notUnderstood: 'Samajh nahi aaya. Type aur naam check karo.',
    whichParty: 'Kaun se {{name}}? {{options}}?',
    whatItem: 'Kya saamaan?',
    newPerson: 'Naya naam',
  },
  en: {
    howMuchDue: 'How much is due?',
    howMuchPaid: 'How much was paid?',
    howMuchCredit: 'How much credit?',
    howMuchReceived: 'How much was received?',
    amountNotHeard: 'Amount was not clear in the note. How much?',
    whoName: 'Whose name?',
    nameNotHeard: 'This name was not in the note. Who?',
    dateNotHeard: 'Date was not in the note. By when?',
    itemNotHeard: 'Item was not clear. Which item?',
    notUnderstood: "Didn't understand. Check type and name.",
    whichParty: 'Which {{name}}? {{options}}?',
    whatItem: 'Which item?',
    newPerson: 'New person',
  },
  mr: {
    howMuchDue: 'किती द्यायचे आहेत?',
    howMuchPaid: 'किती दिले?',
    howMuchCredit: 'किती उधार?',
    howMuchReceived: 'किती पैसे मिळाले?',
    amountNotHeard: 'रक्कम नीट ऐकू आली नाही. किती?',
    whoName: 'कोणाचे नाव?',
    nameNotHeard: 'हे नाव नोटमध्ये नव्हते. कोण?',
    dateNotHeard: 'तारीख नोटमध्ये नव्हती. कधीपर्यंत?',
    itemNotHeard: 'मालाचे नाव नीट ऐकू आले नाही. काय?',
    notUnderstood: 'समजले नाही. प्रकार आणि नाव तपासा.',
    whichParty: 'कोणते {{name}}? {{options}}?',
    whatItem: 'कोणता माल?',
    newPerson: 'नवीन नाव',
  },
  gu: {
    howMuchDue: 'કેટલા આપવાના છે?',
    howMuchPaid: 'કેટલા આપ્યા?',
    howMuchCredit: 'કેટલું ઉધાર?',
    howMuchReceived: 'કેટલા પૈસા મળ્યા?',
    amountNotHeard: 'રકમ બરાબર સંભળાઈ નહીં. કેટલા?',
    whoName: 'કોનું નામ?',
    nameNotHeard: 'આ નામ નોંધમાં ન હતું. કોણ?',
    dateNotHeard: 'તારીખ નોંધમાં ન હતી. ક્યાં સુધી?',
    itemNotHeard: 'માલનું નામ બરાબર સંભળાયું નહીં. શું?',
    notUnderstood: 'સમજાયું નહીં. પ્રકાર અને નામ તપાસો.',
    whichParty: 'કયા {{name}}? {{options}}?',
    whatItem: 'કયો માલ?',
    newPerson: 'નવું નામ',
  },
};

const OR: Record<Lang, string> = { hi: ' ya ', en: ' or ', mr: ' की ', gu: ' કે ' };

export function doubt(lang: Lang, key: DoubtKey, vars: Record<string, string> = {}): string {
  let s = (M[lang] ?? M.hi)[key];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{{${k}}}`, v);
  return s;
}
export function orList(lang: Lang, names: string[]): string {
  return names.join(OR[lang] ?? OR.hi);
}
