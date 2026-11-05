// Moment kinds and their three suggested calls (pure: used by the server and the app).
export const MOMENT_KINDS=['year','birthday','trip','wedding','night','baby','job','own','event'] as const;
export type MomentKind=typeof MOMENT_KINDS[number];
type Lang='tr'|'en';
type Starter={text:string;answerType:'friend'|'choice';options?:string[]};

/** Three suggested calls per kind, with names filled in. People keep, edit or swap them. */
export function starters(kind:MomentKind,lang:Lang,who=''):Starter[]{
 const n=who||(lang==='tr'?'O':'They');
 const yes:Starter['answerType']='choice',friend:Starter['answerType']='friend';
 const S:Record<MomentKind,Record<Lang,Starter[]>>={
  year:{tr:[{text:'Bu yıl gruptan ilk kim nişanlanır?',answerType:friend},{text:'Yaz tatili planı gerçekten gerçekleşir mi?',answerType:yes},{text:'Kim yeni bir hobiye başlayıp bırakır?',answerType:friend},{text:'Yıl bitmeden kim iş değiştirir?',answerType:friend}],
   en:[{text:'Who gets engaged first this year?',answerType:friend},{text:'Does the summer trip actually happen?',answerType:yes},{text:'Who starts a new hobby and quits it?',answerType:friend},{text:'Who changes jobs before the year is out?',answerType:friend}]},
  birthday:{tr:[{text:`${n} mumları ilk denemede söndürür mü?`,answerType:yes},{text:'Gecenin sonunda kim ağlar?',answerType:friend},{text:'Hediyeyi son anda kim alır?',answerType:friend}],
   en:[{text:`Does ${n} blow out the candles in one go?`,answerType:yes},{text:'Who cries by the end of the night?',answerType:friend},{text:'Who buys the present last minute?',answerType:friend}]},
  trip:{tr:[{text:'Tatilde ilk kim güneşte yanar?',answerType:friend},{text:'Gezi planı ilk günü atlatır mı?',answerType:yes},{text:'Şarj aletini evde unutan kim?',answerType:friend}],
   en:[{text:'Who gets sunburnt first?',answerType:friend},{text:'Does the plan survive day one?',answerType:yes},{text:'Who forgets their charger?',answerType:friend}]},
  wedding:{tr:[{text:'Piste ilk kim çıkar?',answerType:friend},{text:'Sağdıç konuşması ne kadar sürer?',answerType:yes,options:['2 dk’dan az','5 dk','10 dk','Hâlâ dinliyoruz']},{text:'Gecenin sonu dürümcüde biter mi?',answerType:yes}],
   en:[{text:'Who’s first on the dance floor?',answerType:friend},{text:'How long is the best man’s speech?',answerType:yes,options:['Under 2 min','5 min','10 min','Still going']},{text:'Does the night end at a kebab shop?',answerType:yes}]},
  night:{tr:[{text:'“Son bira” deyip iki tane daha söyleyen kim?',answerType:friend},{text:'Kim haber vermeden sıvışır?',answerType:friend},{text:'Eve kaçta dönülür?',answerType:yes,options:['1’den önce','1–3 arası','3’ten sonra','Kahvaltıda']}],
   en:[{text:'Who says “last one” and orders two more?',answerType:friend},{text:'Who leaves without saying goodbye?',answerType:friend},{text:'What time do we get home?',answerType:yes,options:['Before 1am','1–3am','After 3am','At breakfast']}]},
  baby:{tr:[{text:'Kız mı erkek mi?',answerType:yes,options:['Kız','Erkek']},{text:'Bebek tahmini tarihten önce mi gelir?',answerType:yes},{text:'Ebeveynlerden sonra bebeği ilk kim kucaklar?',answerType:friend}],
   en:[{text:'Girl or boy?',answerType:yes,options:['Girl','Boy']},{text:'Does the baby come before the due date?',answerType:yes},{text:'After the parents, who holds the baby first?',answerType:friend}]},
  job:{tr:[{text:`${n} ilk haftada “çok yoğunum” der mi?`,answerType:yes},{text:`${n} ilk ayın sonunda hâlâ mutlu mu?`,answerType:yes},{text:'Kutlamaya kim geç kalır?',answerType:friend}],
   en:[{text:`Does ${n} say “I’m so busy” in the first week?`,answerType:yes},{text:`Is ${n} still happy at the end of the first month?`,answerType:yes},{text:'Who’s late to the celebration?',answerType:friend}]},
  event:{tr:[],en:[]},
  own:{tr:[{text:'Kim geç kalır?',answerType:friend},{text:'Her şey plana göre gider mi?',answerType:yes},{text:'Gecenin yıldızı kim olur?',answerType:friend}],
   en:[{text:'Who’s late?',answerType:friend},{text:'Does it all go to plan?',answerType:yes},{text:'Who steals the show?',answerType:friend}]},
 };
 return S[kind][lang];
}

