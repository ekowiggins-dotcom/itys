import {L} from './i18n';
// All the rules in one place, so the playing screens don't have to explain themselves.
const RULES:[string,string,string,string][]=[
 ['Nothing to spend.','Make as many calls as you like. You only earn points, by being right.','Harcayacak bir şey yok.','İstediğin kadar tahmin yap. Puan sadece bilince gelir.'],
 ['Bold calls score more.','Get it right and you score 10 to 40: 10 if everyone called it, up to 40 the fewer friends saw it coming. Wrong just means 0.','Cesur tahmin daha çok puan getirir.','Bilirsen 10 ile 40 arası: herkes bildiyse 10, ne kadar az kişi bildiyse 40’a kadar. Yanlışsa sadece 0.'],
 ['Who said what stays secret','until a call locks. Once you’ve made your call you see how the group is split (4 said Yes, 2 said No), with no names.','Kim ne dedi gizli kalır,','tahmin kilitlenene kadar. Sen de seçince grubun nasıl bölündüğünü görürsün (4 Evet, 2 Hayır), isimsiz.'],
 ['Calls about you:','you see the call, but not anyone’s answers until it’s settled. You sit those out.','Senin hakkındaki tahminler:','tahmini görürsün ama sonuçlanana kadar kimsenin cevabını göremezsin. Bunlara katılmazsın.'],
 ['Results:','the admin says what happened, or someone the admin picks. Anyone has a day to say it’s not right, and then a friend who stayed out of it decides.','Sonuçlar:','sonucu yönetici ya da onun seçtiği kişi girer. Herkesin itiraz için bir günü var; sonra tahmine katılmayan bir arkadaş karar verir.'],
 ['Nobody settles it?','A week after the event it’s called off and doesn’t count for anyone.','Kimse sonuç girmezse?','Etkinlikten bir hafta sonra iptal olur, kimse için sayılmaz.'],
 ['Oracle of the month.','Whoever tops the month gets the title. Everyone starts level on the 1st.','Ayın kâhini.','Ayı zirvede bitiren unvanı alır. Ayın 1’inde herkes sıfırdan başlar.'],
 ['No money, ever.','Points can’t be bought, sold, gifted or cashed out, and there are no prizes. It’s a game of being right.','Asla para yok.','Puanlar satın alınamaz, satılamaz, hediye edilemez, paraya çevrilemez; ödül de yok. Bu bir bilme oyunu.'],
];
export default function HowItWorks(){
 return <details className="card how"><summary>{L('How it works','Nasıl çalışır')}</summary><ul>
  {RULES.map(([b,p,tb,tp])=><li key={b}><b>{L(b,tb)}</b> {L(p,tp)}</li>)}
 </ul></details>;
}
