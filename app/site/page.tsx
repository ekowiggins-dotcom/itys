'use client';
// The product website: what Who’ll is, for people who haven't been sent a call yet. English, with a switch to Turkish. The hero is a real call you can tap, the way friends meet it in their group chat.
import {useEffect,useState} from 'react';
import './site.css';

type Lang='tr'|'en';
const FRIENDS=[{n:'Arda',c:'#FF8A5B'},{n:'Ege',c:'#6FB7FF'},{n:'Can',c:'#A98BFF'},{n:'Deniz',c:'#4FD39A'}];
/** What the group said before you, shown once you've picked: how the app shows the split, never points. */
const SPLIT:Record<string,number>={Arda:0,Ege:1,Can:2,Deniz:0};

const T={
 tr:{
  lang:'English',start:'Grubunu kur',soon:'iPhone uygulaması yakında',
  call:'Akşamı kim eker?',tap:'Birine dokun',
  picked:(n:string)=>`${n} dedin. Grup şimdilik:`,hidden:'Kim ne dedi, seçimler kapanınca açılır.',again:'Tekrar dene',
  tagline:'Arkadaşlarını tanıyor musun? Kanıtla.',
  lead:'Arkadaşların hakkında tahmin yap. Senin hakkında gerçekten ne düşündüklerini ve kimin bildiğini gör.',
  proofTitle:'Bildiğini kanıtla.',proofText:'Herkes “ben demiştim” der. Artık tarihi var. Kimse bilmezken sen bildiysen en çok puan senin.',
  proofQ:'Tatil gerçekten olur mu?',proofA:'Hayır.',proofYou:'2 Kasım’da sen bildin',proofFew:'5 kişiden 1’i bildi',
  revealTitle:'Senin hakkında ne düşündüklerini gör.',revealText:'Seçimler kapanana kadar cevaplar gizli. Sonra hepsi birden açılır.',
  revealQ:'En son kim evlenir?',revealNote:'5 kişiden 4’ü seni dedi.',you:'Sen',
  howTitle:'Üç adım. Bu kadar.',
  how:[
   ['Sor','Kim geç kalır? En son kim evlenir? Tatil gerçekten olur mu?'],
   ['Paylaş','Grup sohbetine at. Arkadaşların dokunur, seçer. Üyelik yok.'],
   ['Bil','Seçimler kapanır, cevaplar açılır. Ne kadar az kişi bildiyse o kadar çok puan.'],
  ],
  chatTitle:'Tek mesaj. Davetiye bu.',chatText:'Uygulama gerekmez. Karta dokun, adını seç, tahminini yap.',
  chatMsg:'Sen kimi diyorsun? 👀',chatReply:'Can tabii ki 😂',chatDesc:'Arda birini seçti, kimi söylemiyoruz. Sen kimi diyorsun?',
  momentsTitle:'Doğum günü. Tatil. Yılbaşı.',momentsText:'Büyük bir gün ya da uzun bir gece için birkaç tahmin. Soruları siz yazarsınız.',
  capsule:'Bir yıllığına mühürle.',capsuleText:'2027 tahminlerini şimdi yap. Seneye yılbaşına kadar kimse göremez.',
  oracleTitle:'Her ay bir kâhin.',oracleText:'Ayı zirvede bitir, unvanı al. Ayın 1’inde herkes sıfırdan başlar.',
  moneyTitle:'Para yok. Asla.',
  money:['Ücretsiz.','Puan sadece doğru bilene.','Satın alınacak bir şey yok. Paraya çevrilecek bir şey yok.','Ödül yok. Sadece hava atma hakkı.','18+.'],
  faqTitle:'Sorular',
  faq:[
   ['Arkadaşlarımın uygulamayı indirmesi gerekir mi?','Hayır. Link telefonda açılır. Adını seçer, oynar.'],
   ['Sonucu kim girer?','Grubun yöneticisi ya da seçtiği kişi. Bir gün içinde herkes “yanlış” diyebilir.'],
   ['Benim hakkımda soru sorulursa?','Soruyu görürsün, cevapları sonuçlanınca. O tahmine katılmazsın.'],
   ['Kaç kişi oynayabilir?','2 ile 30 arası. En iyisi 4 ile 10.'],
  ],
  endTitle:'İlk “ben demiştim”i başlat.',endText:'Grubuna ad ver, arkadaşlarını ekle, ilk soruyu sor.',
  privacy:'Gizlilik',terms:'Koşullar',help:'Yardım',
 },
 en:{
  lang:'Türkçe',start:'Start your group',soon:'iPhone app coming soon',
  call:'Who bails on Saturday first?',tap:'Tap one',
  picked:(n:string)=>`You said ${n}. The group so far:`,hidden:'Who said what opens when picks close.',again:'Try again',
  tagline:'Know your friends? Prove it.',
  lead:'Make calls about your friends. See what they really think of you, and who saw it coming.',
  proofTitle:'Prove you called it.',proofText:'Everyone says “I knew it”. Now it has a date on it. Be right when nobody else was and you score the most.',
  proofQ:'Does the trip actually happen?',proofA:'No.',proofYou:'You called it on 2 Nov',proofFew:'1 of 5 saw it coming',
  revealTitle:'See what they really think of you.',revealText:'Answers stay hidden until picks close. Then they all open at once.',
  revealQ:'Who marries last?',revealNote:'4 of 5 said you.',you:'You',
  howTitle:'Three steps. That’s it.',
  how:[
   ['Ask','Who’s late? Who marries last? Does the trip actually happen?'],
   ['Share','Drop it in your group chat. Friends tap and pick. No sign-up.'],
   ['Call it','Picks close, answers open. The fewer who saw it coming, the more you score.'],
  ],
  chatTitle:'One message. That’s the invite.',chatText:'No app needed. Tap the card, pick your name, make your call.',
  chatMsg:'Who’s your pick? 👀',chatReply:'Can, obviously 😂',chatDesc:'Arda picked someone. We’re not saying who. Who’s yours?',
  momentsTitle:'Birthdays. Trips. New Year.',momentsText:'A few calls for one big day or one long night. You write the questions.',
  capsule:'Seal it for a year.',capsuleText:'Make your calls for 2027 now. Nobody sees them until next New Year’s Eve.',
  oracleTitle:'One Oracle a month.',oracleText:'Top the month, take the title. Everyone starts level on the 1st.',
  moneyTitle:'No money. Ever.',
  money:['Free.','Points only for being right.','Nothing to buy. Nothing to cash out.','No prizes. Just bragging rights.','18+.'],
  faqTitle:'Questions',
  faq:[
   ['Do my friends need the app?','No. The link opens on their phone. They pick their name and play.'],
   ['Who says what happened?','The group’s admin, or someone they choose. Anyone can say “that’s not right” within a day.'],
   ['What if a question is about me?','You see it, but not the answers, until it’s settled. You sit that one out.'],
   ['How many can play?','2 to 30. Best with 4 to 10.'],
  ],
  endTitle:'Start the first “told you so”.',endText:'Name your group, add your friends, ask the first question.',
  privacy:'Privacy',terms:'Terms',help:'Help',
 },
};

function Face({n,c,size=56}:{n:string;c:string;size?:number}){return <span className="s-face" style={{width:size,height:size,background:c,fontSize:size*0.42}} aria-hidden="true">{n[0]}</span>}

export default function Site(){
 const [lang,setLang]=useState<Lang>('en'),[pick,setPick]=useState('');
 useEffect(()=>{document.documentElement.lang=lang},[lang]);
 const t=T[lang];
 const split=pick?{...SPLIT,[pick]:SPLIT[pick]+1}:SPLIT,total=Object.values(split).reduce((a,b)=>a+b,0);
 return <div className="s">
  <section className="s-hero">
   <nav className="s-nav"><a className="s-mark" href="/site" aria-label="Who’ll"><img src="/brand/wordmark.svg" alt="Who’ll"/></a><button className="s-lang" onClick={()=>{setLang(lang==='tr'?'en':'tr');setPick('')}}>{t.lang}</button></nav>
   <div className="s-hero-in">
    <div className="s-call">
     <p className="s-group"><i/>Agalar</p>
     <h1>{t.call}</h1>
     <div className="s-faces" role="radiogroup" aria-label={t.tap}>{FRIENDS.map(f=><button key={f.n} role="radio" aria-checked={pick===f.n} className={pick===f.n?'on':''} onClick={()=>setPick(f.n)}><Face n={f.n} c={f.c} size={64}/><span>{f.n}</span></button>)}</div>
     <div className="s-after" aria-live="polite">{pick?<>
      <p>{t.picked(pick)}</p>
      <div className="s-split">{FRIENDS.filter(f=>split[f.n]>0).map(f=><div key={f.n} style={{flexGrow:split[f.n],background:f.c}}><b>{f.n}</b> {split[f.n]}</div>)}</div>
      <small>{t.hidden} <button className="s-again" onClick={()=>setPick('')}>{t.again}</button></small>
     </>:<p className="s-hint">{t.tap}</p>}</div>
    </div>
    <div className="s-hero-side">
     <h2 className="s-tagline">{t.tagline}</h2>
     <p className="s-lead">{t.lead}</p>
     <a className="s-btn" href="/">{t.start}</a>
     <p className="s-soon">{t.soon}</p>
    </div>
   </div>
  </section>

  <section className="s-feel">
   <div className="s-wrap s-feel-grid">
    <div>
     <h2>{t.proofTitle}</h2><p className="s-body">{t.proofText}</p>
     <div className="s-result" aria-hidden="true"><p className="s-result-q">{t.proofQ}</p><p className="s-result-a">{t.proofA}</p>
      <div className="s-result-row"><Face n="Arda" c="#FF8A5B" size={40}/><div><b>{t.proofYou}</b><span>{t.proofFew}</span></div><strong>+34</strong></div></div>
    </div>
    <div>
     <h2>{t.revealTitle}</h2><p className="s-body">{t.revealText}</p>
     <div className="s-reveal" aria-hidden="true"><p className="s-result-q">{t.revealQ}</p>
      <div className="s-reveal-row"><Face n="Arda" c="#FF8A5B" size={40}/><b>{t.you}</b><div className="s-reveal-bar"><i style={{width:'80%'}}/></div><span>4</span></div>
      <div className="s-reveal-row"><Face n="Can" c="#A98BFF" size={40}/><b>Can</b><div className="s-reveal-bar"><i style={{width:'20%',background:'#A98BFF'}}/></div><span>1</span></div>
      <p className="s-reveal-note">{t.revealNote} 😭</p></div>
    </div>
   </div>
  </section>

  <section className="s-how">
   <div className="s-wrap s-how-grid">
    <div>
     <h2>{t.howTitle}</h2>
     <ol>{t.how.map(([h,p])=><li key={h}><h3>{h}</h3><p>{p}</p></li>)}</ol>
    </div>
    <figure className="s-phone"><img src={`/site/app-${lang}.webp`} alt="" width={390} height={844}/></figure>
   </div>
  </section>

  <section className="s-chat-sec">
   <div className="s-wrap s-chat-grid">
    <div className="s-chat" aria-hidden="true">
     <div className="s-bubble in"><b style={{color:'#c2185b'}}>Ege</b>{lang==='tr'?'Cumartesi plan ne? 🍻':'Plans for Saturday? 🍻'}</div>
     <div className="s-bubble out"><div className="s-preview"><img src={`/site/card-${lang}.webp`} alt="" width={1200} height={630}/><div><b>{t.call}</b><span>{t.chatDesc}</span><em>wholl.app</em></div></div>{t.chatMsg}</div>
     <div className="s-bubble in"><b style={{color:'#1e88e5'}}>Deniz</b>{t.chatReply}</div>
    </div>
    <div><h2>{t.chatTitle}</h2><p className="s-body">{t.chatText}</p></div>
   </div>
  </section>

  <section className="s-moments">
   <div className="s-wrap">
    <h2>{t.momentsTitle}</h2>
    <p className="s-body">{t.momentsText}</p>
    <div className="s-capsule"><span aria-hidden="true">🔒</span><div><h3>{t.capsule}</h3><p>{t.capsuleText}</p></div></div>
   </div>
  </section>

  <section className="s-oracle">
   <div className="s-wrap s-oracle-grid">
    <div className="s-crown" aria-hidden="true"><Face n="Can" c="#A98BFF" size={120}/><span>👑</span></div>
    <div><h2>{t.oracleTitle}</h2><p className="s-body">{t.oracleText}</p></div>
   </div>
  </section>

  <section className="s-money">
   <div className="s-wrap">
    <h2>{t.moneyTitle}</h2>
    <ul>{t.money.map(m=><li key={m}>{m}</li>)}</ul>
   </div>
  </section>

  <section className="s-faq">
   <div className="s-wrap">
    <h2>{t.faqTitle}</h2>
    {t.faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}
   </div>
  </section>

  <section className="s-end">
   <div className="s-wrap">
    <h2>{t.endTitle}</h2><p className="s-body">{t.endText}</p>
    <a className="s-btn" href="/">{t.start}</a>
   </div>
  </section>
  <footer className="s-foot"><div className="s-wrap"><span className="s-mark small"><img src="/brand/wordmark.svg" alt="Who’ll"/></span><nav><a href="/privacy">{t.privacy}</a><a href="/terms">{t.terms}</a><a href="/support">{t.help}</a></nav></div></footer>
 </div>;
}
