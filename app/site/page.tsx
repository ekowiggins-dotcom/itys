'use client';
// The product website: what Calld is, for people who haven't been sent a call yet. Turkish or English by the phone's
// language, with a switch. The hero is a real call you can tap, the way friends meet it in their group chat.
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
  lead:'Arkadaş grupları için ücretsiz bir tahmin oyunu. Birbiriniz ve planlarınız hakkında soru sorun; kimsenin beklemediğini bilen en çok puanı alır.',
  howTitle:'Nasıl oynanır',
  how:[
   ['Bir soru sor','“Akşamı kim eker?”, “En son kim evlenir?”, “Tatil gerçekten olur mu?” Cevaplar arkadaşların, evet/hayır ya da kendi seçeneklerin.'],
   ['Gruba at','Soru, WhatsApp’ta büyük bir kart olarak görünür. Arkadaşların dokunur, adını seçer, tahminini yapar. Üyelik yok.'],
   ['Sonucu gör','Seçimler kapanınca kim ne dedi açılır. Doğru bilen 10 ile 40 puan alır: ne kadar az kişi bildiyse o kadar çok.'],
  ],
  chatTitle:'Davetiye bir mesaj',chatText:'Kimseye uygulama indirtmek gerekmiyor. Link telefonda açılır, isim seçilir, tahmin yapılır. Kart, kimin seçtiğini gösterir ama ne dediğini söylemez.',
  chatMsg:'Sen kimi diyorsun? 👀',chatReply:'Can tabii ki 😂',chatDesc:'Arda birini seçti, kimi söylemiyoruz. Sen kimi diyorsun?',
  momentsTitle:'Doğum günü, tatil, yılbaşı',momentsText:'Bir etkinlik için birkaç tahmin toplayın: Ege’nin doğum günü, Kaş tatili, cumartesi gecesi. Fikir lazımsa öneriler hazır, ama soruları siz yazarsınız.',
  capsule:'Yılbaşı kapsülü',capsuleText:'2027 tahminlerinizi şimdi mühürleyin. Bir yıl boyunca kimse göremez; seneye yılbaşında birlikte açarsınız.',
  oracleTitle:'Her ayın bir kâhini var',oracleText:'Puanlar ay boyunca birikir. Ayı zirvede bitiren ayın kâhini olur ve unvanı profilinde kalır. Ayın 1’inde herkes sıfırdan başlar; dün katılan biri bile kazanabilir.',
  moneyTitle:'Para yok. Asla.',
  money:['Tamamen ücretsiz.','Puan sadece doğru bilene gelir; kimse puan harcamaz.','Puanlar satın alınmaz, satılmaz, gönderilmez, paraya çevrilmez.','Ödül yok. Sadece hava atma hakkı.','18 yaş ve üzeri için.'],
  faqTitle:'Sorular',
  faq:[
   ['Arkadaşlarımın uygulamayı indirmesi gerekiyor mu?','Hayır. Paylaştığın link telefonda açılır; adlarını seçip hemen tahmin ederler. Uygulama, bildirimler ve hesabını korumak için.'],
   ['Sonucu kim girer?','Grubun yöneticisi ya da onun seçtiği kişi. Herkesin “yanlış” demek için bir günü var; o zaman tahmine katılmayan bir arkadaş karar verir.'],
   ['Benim hakkımda bir soru sorulursa?','Soruyu görürsün ama sonuçlanana kadar kimin ne dediğini göremezsin. O tahmine sen katılmazsın.'],
   ['Kaç kişiyle oynanır?','İki kişi bile yeter, en fazla 30. En eğlencelisi 4 ile 10 kişilik gruplar.'],
  ],
  endTitle:'İlk “ben demiştim”i başlat',endText:'Grubunu kur, arkadaşlarının adlarını yaz, ilk soruyu sor. Bir dakika sürer.',
  privacy:'Gizlilik',terms:'Koşullar',help:'Yardım',
 },
 en:{
  lang:'Türkçe',start:'Start your group',soon:'iPhone app coming soon',
  call:'Who bails on Saturday first?',tap:'Tap one',
  picked:(n:string)=>`You said ${n}. The group so far:`,hidden:'Who said what opens when picks close.',again:'Try again',
  lead:'A free prediction game for friend groups. Ask about each other and your plans; whoever saw it coming when nobody else did scores the most.',
  howTitle:'How it works',
  how:[
   ['Ask a question','“Who bails first?”, “Who marries last?”, “Does the trip actually happen?” Answers are your friends, yes/no, or your own options.'],
   ['Drop it in the group','It shows up in WhatsApp as a big card. Friends tap it, pick their name and make their call. No sign-up.'],
   ['See who called it','When picks close, who said what opens up. Right calls score 10 to 40: the fewer friends who saw it coming, the more you get.'],
  ],
  chatTitle:'The invite is a message',chatText:'Nobody has to download anything. The link opens on their phone, they pick their name and make a call. The card shows who has picked, never what they said.',
  chatMsg:'Who’s your pick? 👀',chatReply:'Can, obviously 😂',chatDesc:'Arda picked someone. We’re not saying who. Who’s yours?',
  momentsTitle:'Birthdays, trips, New Year',momentsText:'Gather a few calls for one occasion: Ege’s birthday, the Kaş trip, Saturday night. Ideas are there if you want them, but you write the questions.',
  capsule:'The New Year capsule',capsuleText:'Seal your calls for 2027 now. Nobody sees them for a year; you open them together next New Year’s Eve.',
  oracleTitle:'Every month has an Oracle',oracleText:'Points add up through the month. Whoever tops it is the Oracle of the month, and the title stays on their profile. Everyone starts level on the 1st, so someone who joined yesterday can win.',
  moneyTitle:'No money. Ever.',
  money:['Completely free.','Points only come from being right; nobody spends any.','Points can’t be bought, sold, sent or cashed out.','No prizes. Just bragging rights.','For players aged 18 and over.'],
  faqTitle:'Questions',
  faq:[
   ['Do my friends need the app?','No. The link you share opens on their phone; they pick their name and call it straight away. The app is for notifications and keeping your account.'],
   ['Who says what happened?','The group’s admin, or someone the admin picks. Everyone gets a day to say it’s not right, and then a friend who stayed out of it decides.'],
   ['What if a question is about me?','You see the question, but not who said what until it’s settled. You sit that one out.'],
   ['How many people can play?','Two is enough, up to 30. It’s most fun with 4 to 10.'],
  ],
  endTitle:'Start the first “told you so”',endText:'Make your group, add your friends’ names, ask the first question. It takes a minute.',
  privacy:'Privacy',terms:'Terms',help:'Help',
 },
};

function Face({n,c,size=56}:{n:string;c:string;size?:number}){return <span className="s-face" style={{width:size,height:size,background:c,fontSize:size*0.42}} aria-hidden="true">{n[0]}</span>}

export default function Site(){
 const [lang,setLang]=useState<Lang>('tr'),[pick,setPick]=useState('');
 useEffect(()=>{try{setLang((navigator.languages?.[0]||navigator.language||'tr').toLowerCase().startsWith('tr')?'tr':'en')}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=lang},[lang]);
 const t=T[lang];
 const split=pick?{...SPLIT,[pick]:SPLIT[pick]+1}:SPLIT,total=Object.values(split).reduce((a,b)=>a+b,0);
 return <div className="s">
  <section className="s-hero">
   <nav className="s-nav"><a className="s-mark" href="/site">calld</a><button className="s-lang" onClick={()=>{setLang(lang==='tr'?'en':'tr');setPick('')}}>{t.lang}</button></nav>
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
     <p className="s-lead">{t.lead}</p>
     <a className="s-btn" href="/">{t.start}</a>
     <p className="s-soon">{t.soon}</p>
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
     <div className="s-bubble out"><div className="s-preview"><img src={`/site/card-${lang}.webp`} alt="" width={1200} height={630}/><div><b>{t.call}</b><span>{t.chatDesc}</span><em>calld.app</em></div></div>{t.chatMsg}</div>
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
  <footer className="s-foot"><div className="s-wrap"><span className="s-mark small">calld</span><nav><a href="/privacy">{t.privacy}</a><a href="/terms">{t.terms}</a><a href="/support">{t.help}</a></nav></div></footer>
 </div>;
}
