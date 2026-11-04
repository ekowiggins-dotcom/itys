// Career points, levels and badges. Career points are every point you've won in the group, added up forever:
// they're never put on a call, so they only go up, and they can't be spent, sent or swapped.
import type {Transaction} from '@electric-sql/pglite';
import {LEAGUES} from './locale';

export const LEVELS=[
 {n:1,name:'Guesser',at:0},{n:2,name:'Hunch Hunter',at:50},{n:3,name:'Gut Feeling',at:150},{n:4,name:'Pundit',at:300},{n:5,name:'Mind Reader',at:500},
 {n:6,name:'Fortune Teller',at:800},{n:7,name:'Oracle',at:1200},{n:8,name:'Time Traveller',at:1800},{n:9,name:'Nostradamus',at:2600},{n:10,name:'The All-Seeing',at:3600},
] as const;
export function levelFor(points:number){
 const i=LEVELS.reduce((best,l,k)=>points>=l.at?k:best,0),l=LEVELS[i],next=LEVELS[i+1];
 return{n:l.n,name:l.name,at:l.at,next:next?{n:next.n,name:next.name,at:next.at,toGo:next.at-points}:null,progress:next?(points-l.at)/(next.at-l.at):1};
}

export const BADGES=[
 {id:'houdini',name:'Houdini',rule:'Called the upset: right when fewer than a quarter of the group agreed.',need:1},
 {id:'lone_wolf',name:'Lone Wolf',rule:'The only one in the group who called it.',need:1},
 {id:'derby',name:'Derby Whisperer',rule:'Got 3 derbies right.',need:3},
 {id:'perfect_weekend',name:'Perfect Weekend',rule:'Every weekend match right (at least 4).',need:1},
 {id:'hat_trick',name:'Hat-trick',rule:'Three right in a row.',need:1},
 {id:'early_bird',name:'Early Bird',rule:'First in the group to make the call, 10 times.',need:10},
 {id:'crowd',name:'Against the Crowd',rule:'Went the other way from most of the group, and was right, 5 times.',need:5},
 {id:'rock_solid',name:'On Fire',rule:'Ten right in a row.',need:1},
] as const;
export type BadgeId=typeof BADGES[number]['id'];

type Pick={user_id:string;question_id:string;answer:string;stake:number;result_answer:string;market:string|null;selection_reason:string|null;settled_at:Date;round_id:string|null;total:number;kickoff:Date|null;timezone:string|null};
type RoundView={id:string;opens_at:string|Date;state:string;standings:{user_id:string;points_tenths:number;rank:number}[];winners:{user_id:string}[]};
const DERBIES=new Set(Object.values(LEAGUES).flatMap(l=>l.derbies.map(d=>d.name)));

export type Career={user_id:string;points:number;level:ReturnType<typeof levelFor>;badges:Record<string,number>;earned:number;weeklyWins:number;top3Streak:number;history:{opens_at:string;points:number;rank:number;final:boolean}[]};

/** Everyone's career in a group. `rounds` are the group's weekly views, newest first. */
export async function careerView(tx:Transaction,groupId:string,rounds:RoundView[]):Promise<Career[]>{
 const totals=new Map((await tx.query<{user_id:string;points:string}>("SELECT s.user_id,COALESCE(sum(s.points_value),0)::text points FROM scores s JOIN questions q ON q.id=s.question_id WHERE q.group_id=$1 AND q.state='settled' AND NOT q.superseded GROUP BY s.user_id",[groupId])).rows.map(r=>[r.user_id,Math.round(Number(r.points))]));
 const members=(await tx.query<{user_id:string}>('SELECT user_id FROM members WHERE group_id=$1 ORDER BY joined_at,user_id',[groupId])).rows.map(r=>r.user_id);
 const picks=(await tx.query<Pick>(`SELECT lp.user_id,lp.question_id,lp.answer,lp.stake,q.result_answer,q.market,q.selection_reason,q.settled_at,q.round_id,ls.total,f.kickoff,r.timezone
  FROM locked_predictions lp JOIN lock_snapshots ls ON ls.question_id=lp.question_id JOIN questions q ON q.id=lp.question_id
  LEFT JOIN football_fixtures f ON f.id=q.fixture_id LEFT JOIN rounds r ON r.id=q.round_id
  WHERE q.group_id=$1 AND q.state='settled' AND NOT q.superseded AND q.result_answer IS NOT NULL ORDER BY q.settled_at,q.id`,[groupId])).rows;
 const firsts=(await tx.query<{user_id:string;n:number}>(`SELECT user_id,count(*)::int n FROM (SELECT DISTINCT ON (p.question_id) p.question_id,p.user_id FROM predictions p JOIN questions q ON q.id=p.question_id WHERE q.group_id=$1 AND NOT q.superseded ORDER BY p.question_id,p.submitted_at,p.user_id) x GROUP BY user_id`,[groupId])).rows;
 const byQuestion=new Map<string,Pick[]>();for(const p of picks){const list=byQuestion.get(p.question_id)||[];list.push(p);byQuestion.set(p.question_id,list)}
 const badges=new Map<string,Record<string,number>>(members.map(m=>[m,{}]));const add=(u:string,b:BadgeId,n=1)=>{const r=badges.get(u)||{};r[b]=(r[b]||0)+n;badges.set(u,r)};
 const run=new Map<string,number>(),weekend=new Map<string,{all:number;right:number}>();
 for(const p of picks){
  const same=byQuestion.get(p.question_id)!,right=p.answer===p.result_answer,agreeing=same.filter(x=>x.answer===p.answer).length,total=same.length;
  if(right){
   if(total>=4&&agreeing/total<0.25)add(p.user_id,'houdini');
   if(total>=3&&agreeing===1)add(p.user_id,'lone_wolf');
   if(total>=3&&agreeing/total<0.5)add(p.user_id,'crowd');
   const reason=(p.selection_reason||'').replace(/^Match of the week · /,'');if(p.market==='result'&&DERBIES.has(reason))add(p.user_id,'derby');
  }
  const streak=right?(run.get(p.user_id)||0)+1:0;run.set(p.user_id,streak);if(streak>0&&streak%3===0)add(p.user_id,'hat_trick');if(streak>0&&streak%10===0)add(p.user_id,'rock_solid');
  if(p.market==='result'&&p.kickoff&&p.round_id){const day=new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone||'UTC',weekday:'short'}).format(new Date(p.kickoff));if(day==='Sat'||day==='Sun'){const k=p.user_id+'|'+p.round_id,w=weekend.get(k)||{all:0,right:0};w.all++;if(right)w.right++;weekend.set(k,w)}}
 }
 for(const [k,w] of weekend)if(w.all>=4&&w.right===w.all)add(k.split('|')[0],'perfect_weekend');
 for(const f of firsts)if(f.n>0)add(f.user_id,'early_bird',f.n);
 const finals=rounds.filter(r=>r.state==='final');
 return members.map(u=>{
  const points=totals.get(u)||0,raw=badges.get(u)||{};
  // A badge counts once its target is reached; the number is how many times (or for counters, how many calls).
  const earnedBadges:Record<string,number>={};for(const b of BADGES){const n=raw[b.id]||0;if(n>=b.need)earnedBadges[b.id]=n}
  let top3Streak=0;for(const r of finals){const s=r.standings.find(x=>x.user_id===u);if(s&&s.points_tenths>0&&s.rank<=3)top3Streak++;else break}
  const history=rounds.filter(r=>['final','provisional','live'].includes(r.state)).slice(0,6).map(r=>{const s=r.standings.find(x=>x.user_id===u);return{opens_at:new Date(r.opens_at).toISOString(),points:Math.round((s?.points_tenths||0)/10),rank:s?.rank||0,final:r.state==='final'}}).filter(h=>h.rank>0);
  return{user_id:u,points,level:levelFor(points),badges:earnedBadges,earned:Object.keys(earnedBadges).length,weeklyWins:finals.filter(r=>r.winners.some(w=>w.user_id===u)).length,top3Streak,history};
 });
}
