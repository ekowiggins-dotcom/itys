import {L} from './i18n';
// "When will we know?" turned into real times. Pure, so it's tested without a browser.
const MIN=60000,H=60*MIN,D=24*H;
function at(base:number,days:number,hour:number,minute=0){const d=new Date(base);d.setDate(d.getDate()+days);d.setHours(hour,minute,0,0);return d.getTime()}
function nextWeekday(now:number,weekday:number,hour:number){const d=new Date(now);const add=(weekday-d.getDay()+7)%7;let t=at(now,add,hour);if(t<=now)t=at(now,add+7,hour);return t}
export type Choice={id:'tonight'|'week'|'later';label:string;sub:string;lock:number;event?:number;ok:boolean;why?:string};

/** Tonight and This week are this round's calls; Later is a long-running call that counts for the season. */
export function whenChoices(now:number,o:{practice:boolean;weeklyOpen:boolean;weeklyWhy?:string;deadline:number|null;month?:number}):Choice[]{
 const soon=now+20*MIN,deadline=o.deadline??0;
 const fits=(t:number)=>o.weeklyOpen&&t>soon&&t<=deadline;
 if(o.practice){
  const tonight=Math.min(now+10*MIN,deadline),week=Math.min(now+30*MIN,deadline);
  return[{id:'tonight',label:'Soon',sub:'locks in 10 min',lock:tonight,ok:o.weeklyOpen&&tonight>now+MIN,why:o.weeklyWhy},{id:'week',label:'This round',sub:'locks in 30 min',lock:week,ok:o.weeklyOpen&&week>now+MIN,why:o.weeklyWhy},{id:'later',label:'Later',sub:'in 30 min',lock:now+5*MIN,event:now+30*MIN,ok:true}];
 }
 let tonight=at(now,0,21);if(tonight<=soon)tonight=at(now,0,23,30);
 let week=nextWeekday(now,6,12);if(!fits(week))week=deadline;
 const months=laterMonths(now),month=months.find(m=>m.index===o.month)||months[0];
 return[
  {id:'tonight',label:L('Tonight','Bu akşam'),sub:fits(tonight)?L('picks close ','kapanış ')+hhmm(tonight):L('too late tonight','bu akşam için geç'),lock:tonight,ok:fits(tonight),why:o.weeklyOpen?L('Too late for tonight. Try This week.','Bu akşam için geç. Bu haftayı dene.'):o.weeklyWhy},
  {id:'week',label:L('This week','Bu hafta'),sub:L('by Sunday','pazara kadar'),lock:week,ok:fits(week),why:o.weeklyWhy},
  {id:'later',label:L('Later','Daha sonra'),sub:L('pick a month','bir ay seç'),lock:Math.min(at(now,3,12),month.event),event:month.event,ok:true},
 ];
}
const hhmm=(t:number)=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
/** The next six months whose end is at least a week away. The call resolves by the last day of the month. */
export function laterMonths(now:number){
 const out:{index:number;name:string;event:number}[]=[];const d=new Date(now);
 for(let i=0;out.length<6&&i<8;i++){const end=new Date(d.getFullYear(),d.getMonth()+i+1,0,23,59,0,0).getTime();if(end-now<8*D)continue;out.push({index:i,name:new Date(d.getFullYear(),d.getMonth()+i,1).toLocaleDateString(L('en-GB','tr-TR'),{month:'long'}),event:end})}
 return out;
}
