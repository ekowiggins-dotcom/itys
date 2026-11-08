import {L} from './i18n';
// All the rules in one place, so the playing screens don't have to explain themselves.
const RULES:[string,string,string,string][]=[
 ['Nothing to spend.','Make as many calls as you like. You only earn points, by being right.','Harcayacak bir şey yok.','İstediğin kadar tahmin yap. Puan sadece bilince gelir.'],
 ['Bold calls score more.','Get it right and you score 10 to 40: 10 if everyone called it, up to 40 the fewer friends saw it coming. Wrong just means 0.','Cesur tahmin daha çok puan getirir.','Bilirsen 10 ile 40 arası: herkes bildiyse 10, ne kadar az kişi bildiyse 40’a kadar. Yanlışsa sadece 0.'],
 ['Live or sealed.','Live: once you’ve picked, you watch the group’s split as it comes in (4 said Arda, 3 said Can); names show when picks close. Sealed: nobody sees a thing until the day you open it together.','Canlı ya da mühürlü.','Canlı: seçimini yapınca grubun nasıl bölündüğünü canlı izlersin (4 kişi Arda, 3 kişi Can); isimler kapanışta görünür. Mühürlü: birlikte açacağınız güne kadar kimse hiçbir şey göremez.'],
 ['Calls about you:','you see the call, but not anyone’s answers until it’s settled. You sit those out.','Senin hakkındaki tahminler:','tahmini görürsün ama sonuçlanana kadar kimsenin cevabını göremezsin. Bunlara katılmazsın.'],
 ['Results:','whoever posted the call says what happened, or someone they hand it to (two days late, anyone can). Anyone has a day to say it’s not right; then the whole group votes, in the open. Most votes wins, and a tie keeps what was said.','Sonuçlar:','sonucu tahmini açan kişi ya da onun seçtiği kişi girer (iki gün gecikirse herkes girebilir). Herkesin itiraz için bir günü var; sonra tüm grup açık oyla karar verir. En çok oy kazanır, eşitlikte girilen sonuç kalır.'],
 ['Nobody settles it?','The settler gets a nudge, then everyone can. A week after the event it’s called off and doesn’t count for anyone.','Kimse sonuç girmezse?','Sonucu girecek kişiye hatırlatma gider, sonra herkes girebilir. Etkinlikten bir hafta sonra iptal olur, kimse için sayılmaz.'],
 ['Oracle of the month.','Whoever tops the month gets the title. Everyone starts level on the 1st.','Ayın kâhini.','Ayı zirvede bitiren unvanı alır. Ayın 1’inde herkes sıfırdan başlar.'],
 ['No money, ever.','Points can’t be bought, sold, gifted or cashed out, and there are no prizes. It’s a game of being right.','Asla para yok.','Puanlar satın alınamaz, satılamaz, hediye edilemez, paraya çevrilemez; ödül de yok. Bu bir bilme oyunu.'],
];
export default function HowItWorks(){
 return <details className="card how"><summary>{L('How it works','Nasıl çalışır')}</summary><ul>
  {RULES.map(([b,p,tb,tp])=><li key={b}><b>{L(b,tb)}</b> {L(p,tp)}</li>)}
 </ul></details>;
}
