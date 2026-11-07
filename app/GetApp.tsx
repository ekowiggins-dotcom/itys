'use client';
// The web is a taster once the app is in the App Store: you can join from a friend's link and make that first pick,
// then the rest happens in the app. Saving with Apple here means the app opens straight into the same account.
import {L} from './i18n';
import {AppleButton,Wordmark} from './ui';

export default function GetApp({group,picked,linked,canApple,storeUrl,busy,onApple,notice,error}:{group?:string;picked:boolean;linked:boolean;canApple:boolean;storeUrl:string|null;busy:boolean;onApple:()=>void;notice?:string;error?:string}){
 return <main className="c-getapp">
  <div className="c-landing-top"><Wordmark on="light" h={30}/><span className="c-pill">{L('Free. No money. Ever.','Ücretsiz. Para yok. Asla.')}</span></div>
  <h1>{picked?L('Your call is in.','Tahminin kaydedildi.'):group?L('You’re in.','Gruptasın.'):L('Who’ll lives in the app.','Who’ll uygulamada.')}</h1>
  <p className="c-lead">{group
   ?L(`See what everyone in ${group} said when picks close, make your own calls and get told the moment one is settled. That all happens in the app.`,`${group} grubunda kimin ne dediğini görmek, kendi tahminlerini yapmak ve sonuç belli olunca haber almak için uygulamayı indir.`)
   :L('Make calls about your friends, see who said what, and find out who really knows the group.','Arkadaşların hakkında tahmin yap, kim ne dedi gör, grubu en iyi kim tanıyor öğren.')}</p>
  <ol className="c-getapp-steps">
   {!linked&&canApple&&<li><b>{L('Save your account with Apple','Hesabını Apple ile kaydet')}</b><span>{L('One tap. Your pick and your group come with you.','Tek dokunuş. Tahminin ve grubun seninle gelir.')}</span></li>}
   <li><b>{L('Get Who’ll from the App Store','Who’ll’u App Store’dan indir')}</b><span>{L('Free, no ads, no money.','Ücretsiz, reklamsız, parasız.')}</span></li>
   <li><b>{L('Sign in with the same Apple ID','Aynı Apple kimliğiyle giriş yap')}</b><span>{group?L(`You’re straight back in ${group}.`,`Doğrudan ${group} grubuna dönersin.`):L('Your groups are waiting.','Grupların seni bekliyor.')}</span></li>
  </ol>
  {!linked&&canApple?<AppleButton busy={busy} onClick={onApple}>{storeUrl?L('Sign in with Apple & get the app','Apple ile giriş yap ve uygulamayı indir'):L('Sign in with Apple','Apple ile giriş yap')}</AppleButton>:null}
  {storeUrl?<a className={'c-btn'+(!linked&&canApple?' ghost':'')} href={storeUrl}>{L('Get the app','Uygulamayı indir')}</a>:<p className="c-sub">{L('The app is coming to the App Store soon.','Uygulama yakında App Store’da.')}</p>}
  {error&&<p className="c-toast error" role="alert">{error}</p>}{notice&&<p className="c-toast" role="status">{notice}</p>}
 </main>;
}
