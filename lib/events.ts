// Big moments everyone shares. They show up as occasions in "New Moment", with the date and a few suggested calls filled in;
// the group writes its own. A week before, the group gets one nudge to start one. Dates are Istanbul time.
export type EventDef={key:string;emoji:string;en:string;tr:string;starts:string;region:'all'|'TR';sealed?:{opens:string};
 calls:{tr:{text:string;answerType:'friend'|'choice';options?:string[]}[];en:{text:string;answerType:'friend'|'choice';options?:string[]}[]}};
const F='friend' as const,C='choice' as const;
export const EVENTS:EventDef[]=[
 {key:'nye-2026',emoji:'🥂',en:'New Year’s Eve',tr:'Yılbaşı gecesi',starts:'2026-12-31T21:00:00+03:00',region:'all',calls:{
  tr:[{text:'Gece yarısından önce kim uyuyakalır?',answerType:F},{text:'Gruba ilk “mutlu yıllar” mesajını kim atar?',answerType:F},{text:'Gece sabah 3’ü geçer mi?',answerType:C}],
  en:[{text:'Who falls asleep before midnight?',answerType:F},{text:'Who sends the first “happy new year” to the group?',answerType:F},{text:'Does the night go past 3am?',answerType:C}]}},
 {key:'valentines-2027',emoji:'💘',en:'Valentine’s Day',tr:'Sevgililer Günü',starts:'2027-02-14T20:00:00+03:00',region:'all',calls:{
  tr:[{text:'Sevgililer Günü’nü kim unutur?',answerType:F},{text:'Kimin planı son anda iptal olur?',answerType:F},{text:'İlk story’yi kim atar?',answerType:F}],
  en:[{text:'Who forgets it’s Valentine’s Day?',answerType:F},{text:'Whose plans get cancelled last minute?',answerType:F},{text:'Who posts the first story?',answerType:F}]}},
 {key:'ramazan-2027',emoji:'🌙',en:'Ramazan Bayramı',tr:'Ramazan Bayramı',starts:'2027-03-09T10:00:00+03:00',region:'TR',calls:{
  tr:[{text:'Bayramda kaç akraba ziyareti olur?',answerType:C,options:['3’ten az','3–6','7–10','Saymayı bıraktık']},{text:'“Ne zaman evleniyorsun?” sorusunu ilk kim duyar?',answerType:F},{text:'Kim en çok şeker toplar?',answerType:F}],
  en:[{text:'How many relatives do we visit?',answerType:C,options:['Under 3','3–6','7–10','Lost count']},{text:'Who gets “when are you getting married?” first?',answerType:F},{text:'Who collects the most sweets?',answerType:F}]}},
 {key:'oscars-2027',emoji:'🏆',en:'Oscars night',tr:'Oscar gecesi',starts:'2027-03-15T03:00:00+03:00',region:'all',calls:{
  tr:[{text:'En İyi Film ödülü favoriye mi gider?',answerType:C},{text:'Canlı izlemek için sabaha kadar kim uyanık kalır?',answerType:F},{text:'Sunucu yapay zekâ esprisi yapar mı?',answerType:C}],
  en:[{text:'Does Best Picture go to the favourite?',answerType:C},{text:'Who stays up all night to watch it live?',answerType:F},{text:'Does the host make an AI joke?',answerType:C}]}},
 {key:'eurovision-2027',emoji:'🎤',en:'Eurovision final',tr:'Eurovision finali',starts:'2027-05-15T22:00:00+03:00',region:'all',calls:{
  tr:[{text:'Sıfır puan alan bir ülke olur mu?',answerType:C},{text:'Ev sahibi Bulgaristan ilk 10’a girer mi?',answerType:C},{text:'Gruptan ilk kim şarkıya eşlik eder?',answerType:F}],
  en:[{text:'Does any country get zero points?',answerType:C},{text:'Does host Bulgaria make the top 10?',answerType:C},{text:'Who in the group sings along first?',answerType:F}]}},
 {key:'kurban-2027',emoji:'🐑',en:'Kurban Bayramı',tr:'Kurban Bayramı',starts:'2027-05-16T10:00:00+03:00',region:'TR',calls:{
  tr:[{text:'Bayram tatili için kim şehirden kaçar?',answerType:F},{text:'Aile sofrasında kaç kez “bir tane daha al” denir?',answerType:C,options:['2','5','10+','Saymayı bıraktık']},{text:'Bayram planı bir hafta önceden netleşir mi?',answerType:C}],
  en:[{text:'Who escapes the city for the holiday?',answerType:F},{text:'How many times do we hear “have one more” at the table?',answerType:C,options:['2','5','10+','Lost count']},{text:'Is the holiday plan settled a week ahead?',answerType:C}]}},
 {key:'summer-2027',emoji:'☀️',en:'Summer predictions',tr:'Yaz kehanetleri',starts:'2027-06-21T21:00:00+03:00',region:'all',sealed:{opens:'2027-09-22T21:00:00+03:00'},calls:{
  tr:[{text:'Yaz tatili planı gerçekten gerçekleşir mi?',answerType:C},{text:'Bu yaz kim yeni bir ilişkiye başlar?',answerType:F},{text:'Kim en çok yeri gezer?',answerType:F}],
  en:[{text:'Does the summer trip actually happen?',answerType:C},{text:'Who starts a new relationship this summer?',answerType:F},{text:'Who travels the most?',answerType:F}]}},
];
export const eventByKey=(key?:string|null)=>EVENTS.find(e=>e.key===key);
/** Events that haven't started, for this group's region, within `days`. */
export function upcomingEvents(now:number,opts:{country?:string|null;lang?:string|null;days?:number}={}){
 const tr=opts.country==='TR'||opts.lang==='tr',horizon=now+(opts.days??120)*86400000;
 return EVENTS.filter(e=>(e.region==='all'||tr)&&Date.parse(e.starts)>now&&Date.parse(e.starts)<=horizon).sort((a,b)=>Date.parse(a.starts)-Date.parse(b.starts));
}
