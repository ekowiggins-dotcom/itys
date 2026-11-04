// Sign in with Apple on both sides: the native sheet in the app, Apple's own popup on the web. Returns Apple's identity token.
import {NATIVE} from './api-client';
declare global{interface Window{AppleID?:{auth:{init(o:Record<string,unknown>):void;signIn():Promise<{authorization:{id_token:string}}>}}}}
let script:Promise<void>|null=null;
function loadAppleJs(){return script||=new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';s.onload=()=>ok();s.onerror=()=>{script=null;fail(Error('Couldn’t reach Apple. Try again.'))};document.head.appendChild(s)})}
/** null if the person closed the sheet. */
export async function appleIdToken(servicesId:string|null):Promise<string|null>{
 try{
  if(NATIVE){const {registerPlugin}=await import('@capacitor/core');const r=await registerPlugin<{authorize():Promise<{idToken:string}>}>('AppleSignIn').authorize();return r.idToken}
  if(!servicesId)throw Error('Apple sign-in isn’t set up yet.');
  await loadAppleJs();window.AppleID!.auth.init({clientId:servicesId,scope:'',redirectURI:location.origin+'/',usePopup:true});
  return (await window.AppleID!.auth.signIn()).authorization.id_token;
 }catch(e){const m=String((e as {error?:string;message?:string})?.error||(e as Error)?.message||e);if(/cancel|popup_closed/i.test(m))return null;throw e instanceof Error?e:Error(m)}
}
