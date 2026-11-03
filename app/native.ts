'use client';
// iOS-only capabilities. Every function is a no-op on the web, and plugins load lazily
// so the web bundle never pulls in native code paths.
import {NATIVE,api} from './api-client';

let listening=false,registered=false;

/** Deep links (universal links + notification taps) and push registration. Safe to call repeatedly. */
export async function initNative(opts:{onOpen?:(url:string)=>void;register?:boolean}={}){
 if(!NATIVE)return;
 const [{App},{PushNotifications}]=await Promise.all([import('@capacitor/app'),import('@capacitor/push-notifications')]);
 if(!listening){
  listening=true;
  void App.addListener('appUrlOpen',e=>opts.onOpen?.(e.url));
  void PushNotifications.addListener('registration',t=>{void api('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registerDevice',token:t.value,platform:'ios',environment:process.env.NEXT_PUBLIC_APNS_ENV==='sandbox'?'sandbox':'production'})})});
  void PushNotifications.addListener('pushNotificationActionPerformed',a=>{const d=a.notification.data as {invite?:string;questionId?:string;roundId?:string};if(!d?.invite)return;const q=new URLSearchParams({invite:d.invite});if(d.questionId)q.set('question',d.questionId);if(d.roundId)q.set('round',d.roundId);location.href='/?'+q.toString()});
 }
 // Ask for permission only once the person is in a group, where alerts actually mean something.
 if(opts.register&&!registered){
  registered=true;
  const p=await PushNotifications.checkPermissions();
  const status=p.receive==='prompt'||p.receive==='prompt-with-rationale'?(await PushNotifications.requestPermissions()).receive:p.receive;
  if(status==='granted')await PushNotifications.register();
 }
}

export async function haptic(kind:'pick'|'win'|'tap'){
 if(!NATIVE)return;
 const {Haptics,ImpactStyle,NotificationType}=await import('@capacitor/haptics');
 if(kind==='win')await Haptics.notification({type:NotificationType.Success});
 else await Haptics.impact({style:kind==='pick'?ImpactStyle.Medium:ImpactStyle.Light});
}

/** Native share sheet with the share-card image attached. Returns false when not in the app. */
export async function shareCard(file:File,text:string,url:string){
 if(!NATIVE)return false;
 const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
 const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(file)});
 const saved=await Filesystem.writeFile({path:file.name,data,directory:Directory.Cache});
 await Share.share({title:'Sidebet',text,url,files:[saved.uri]});
 return true;
}

export type WidgetState={group:string;rank:number|null;members:number;points:number|null;toGo:number;nextLockAt:string|null;updatedAt:string;invite:string};
/** Hands the home-screen widget its data (stored in the shared App Group, read by WidgetKit). */
export async function updateWidget(state:WidgetState){
 if(!NATIVE)return;
 const {registerPlugin}=await import('@capacitor/core');
 const bridge=registerPlugin<{setState(o:{json:string}):Promise<void>}>('WidgetBridge');
 try{await bridge.setState({json:JSON.stringify(state)})}catch{/* widget extension not installed yet */}
}
