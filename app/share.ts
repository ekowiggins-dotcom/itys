'use client';
import {NATIVE} from './api-client';
/** Share one message (the link inside it brings its own preview). Returns how it went. */
export async function shareMessage(text:string):Promise<'shared'|'copied'|'cancelled'|'failed'>{
 try{
  if(NATIVE){const {Share}=await import('@capacitor/share');await Share.share({text});return 'shared'}
  if(navigator.share){await navigator.share({text});return 'shared'}
 }catch(e){if((e as Error).name==='AbortError'||/cancel/i.test((e as Error).message))return 'cancelled'}
 try{await navigator.clipboard.writeText(text);return 'copied'}catch{return 'failed'}
}
export async function copyText(text:string){try{await navigator.clipboard.writeText(text);return true}catch{return false}}
