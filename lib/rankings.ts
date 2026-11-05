// The Ranking tab: one table over time instead of weekly rounds. Every point counts on the day its call settles,
// whatever kind of call it was. "This week" and "This month" follow the group's own clock; all-time is the career table.
// At the end of each month the top of that month's table is the Oracle of the month (ties share it). Bragging rights only.
import type {Transaction} from '@electric-sql/pglite';
import {rankStandings,type Standing} from './rules';
import {emitNotification} from './notifications';

/** Local calendar parts of an instant in a time zone. */
function parts(at:Date,zone:string){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23',weekday:'short'}).formatToParts(at).map(x=>[x.type,x.value]));
 return{y:+p.year,m:+p.month,d:+p.day,h:+p.hour,min:+p.minute,s:+p.second,wd:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday)};
}
/** The instant of local midnight on y-m-d in `zone`. */
function localMidnight(y:number,m:number,d:number,zone:string){
 const guess=new Date(Date.UTC(y,m-1,d));const p=parts(guess,zone);
 const shown=Date.UTC(p.y,p.m-1,p.d,p.h,p.min,p.s);return new Date(guess.getTime()-(shown-guess.getTime()));
}
export function weekStart(now:Date,zone:string){const p=parts(now,zone);const t=new Date(Date.UTC(p.y,p.m-1,p.d-p.wd));return localMidnight(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate(),zone)}
export function monthStart(now:Date,zone:string,back=0){const p=parts(now,zone);const t=new Date(Date.UTC(p.y,p.m-1-back,1));return localMidnight(t.getUTCFullYear(),t.getUTCMonth()+1,1,zone)}
const monthKey=(start:Date,zone:string)=>{const p=parts(start,zone);return p.y+'-'+String(p.m).padStart(2,'0')};
export const monthName=(key:string)=>new Date(key+'-15T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'});

async function table(tx:Transaction,groupId:string,from:Date,to:Date):Promise<Standing[]>{
 const rows=(await tx.query<Omit<Standing,'rank'>>(`SELECT u.id user_id,u.name,COALESCE(m.active,false) active,COALESCE(t.points_tenths,0)::int points_tenths,0 exact_correct
  FROM users u LEFT JOIN members m ON m.group_id=$1 AND m.user_id=u.id
  LEFT JOIN (SELECT s.user_id,sum(s.points_tenths) points_tenths FROM scores s JOIN questions q ON q.id=s.question_id WHERE q.group_id=$1 AND s.settled_at>=$2 AND s.settled_at<$3 GROUP BY 1) t ON t.user_id=u.id
  WHERE m.active OR t.points_tenths>0`,[groupId,from,to])).rows;
 return rankStandings(rows);
}
export type Oracle={month:string;winners:{user_id:string;name:string;points_tenths:number}[]};
/** Week and month tables, past Oracles of the month and how many titles each person holds. */
export async function timeBoards(tx:Transaction,groupId:string,zone:string,now:Date){
 const weekFrom=weekStart(now,zone),monthFrom=monthStart(now,zone),week=await table(tx,groupId,weekFrom,now),month=await table(tx,groupId,monthFrom,now);
 const first=(await tx.query<{at:Date|null}>('SELECT min(s.settled_at) at FROM scores s JOIN questions q ON q.id=s.question_id WHERE q.group_id=$1',[groupId])).rows[0]?.at;
 const oracles:Oracle[]=[];
 if(first)for(let back=1;back<=24;back++){
  const start=monthStart(now,zone,back),end=monthStart(now,zone,back-1);if(end<=new Date(first))break;
  const winners=(await table(tx,groupId,start,end)).filter(r=>r.rank===1&&r.points_tenths>0).map(r=>({user_id:r.user_id,name:r.name,points_tenths:r.points_tenths}));
  if(winners.length)oracles.push({month:monthKey(start,zone),winners});
 }
 const titles:Record<string,number>={};for(const o of oracles)for(const w of o.winners)titles[w.user_id]=(titles[w.user_id]||0)+1;
 return{weekFrom,monthFrom,week,month,monthLabel:monthName(monthKey(monthStart(now,zone),zone)),oracles,titles};
}
/** Once a month: tell the group who called last month best. */
export async function announceOracle(tx:Transaction,group:{id:string;timezone:string},now:Date){
 const start=monthStart(now,group.timezone,1),end=monthStart(now,group.timezone);
 if(now.getTime()-end.getTime()>7*86400000)return;
 const winners=(await table(tx,group.id,start,end)).filter(r=>r.rank===1&&r.points_tenths>0);if(!winners.length)return;
 const key=monthKey(start,group.timezone),month=monthName(key).split(' ')[0],names=winners.slice(0,3).map(w=>w.name).join(' & ');
 const text=`${names} ${winners.length>1?'are':'is'} ${month}’s Oracle${winners.length>1?'s':''} with ${Math.round(winners[0].points_tenths/10)} points. A new month starts now.`;
 const members=(await tx.query<{user_id:string}>('SELECT user_id FROM members WHERE group_id=$1 AND active',[group.id])).rows;
 for(const m of members)await emitNotification(tx,{groupId:group.id,userId:m.user_id,key:'oracle:'+key,kind:'month_final',text,eventAt:end},now);
}
