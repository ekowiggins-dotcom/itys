// The interface follows the group's language (Turkish groups get Turkish buttons), or the phone's before you're in one.
// Strings stay in English in the code; t() looks up the Turkish. A missing entry shows the English, never a blank.
import {TR} from './i18n-tr';
export type Lang='tr'|'en';
let current:Lang='en';
export function setLang(l:Lang){current=l}
export function lang():Lang{return current}
export function t(s:string):string{
 if(current!=='tr')return s;
 const k=s.trim(),hit=TR[k];if(!hit)return s;
 return s.slice(0,s.indexOf(k))+hit+s.slice(s.indexOf(k)+k.length);
}
/** For sentences built around numbers and names: pick the language's own version. */
export const L=(en:string,tr:string)=>current==='tr'?tr:en;
