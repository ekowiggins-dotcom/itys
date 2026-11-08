// The operator's view of the MVP test: are groups still playing? Read-only, aggregate numbers only; no names of players,
// no answers. Practice groups are left out. Weeks are Monday-based in Istanbul time.
import {db} from './db';

const DAY=86400000;
const label=(start:Date)=>new Date(start.getTime()+3*3600000).toISOString().slice(0,10);
function weekStartIstanbul(at:Date){const local=new Date(at.getTime()+3*3600000);const d=(local.getUTCDay()+6)%7;return new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-d)-3*3600000)}

export type WeekRow={week:string;newGroups:number;activeGroups:number;calls:number;picks:number;pickRate:number|null;settled:number;callsPerActiveGroup:number|null};
export type Cohort={week:string;groups:number;active:(number|null)[]};
export type GroupRow={name:string;members:number;started:string;calls7:number;picks7:number;lastActive:string|null;unsettled:number;callers7:number};

export async function metrics(now=new Date(),weeks=8){
 const d=await db();
 const real="NOT COALESCE(g.practice,false)";
 const first=weekStartIstanbul(new Date(now.getTime()-(weeks-1)*7*DAY));
 const starts=Array.from({length:weeks},(_,i)=>new Date(first.getTime()+i*7*DAY));
 // When each group started (its first member) and every week it did something (a call made or a pick).
 const groups=(await d.query<{id:string;name:string;started:Date;members:number}>(`SELECT g.id,g.name,min(m.joined_at) started,count(*) FILTER (WHERE m.active)::int members FROM groups g JOIN members m ON m.group_id=g.id WHERE ${real} GROUP BY g.id,g.name`)).rows;
 const activity=(await d.query<{group_id:string;at:Date}>(`SELECT q.group_id,q.created_at at FROM questions q JOIN groups g ON g.id=q.group_id WHERE ${real} AND q.created_at IS NOT NULL
  UNION ALL SELECT q.group_id,p.submitted_at FROM predictions p JOIN questions q ON q.id=p.question_id JOIN groups g ON g.id=q.group_id WHERE ${real}`)).rows;
 const weekOf=(at:Date)=>weekStartIstanbul(new Date(at)).getTime();
 const activeWeeks=new Map<string,Set<number>>();for(const a of activity){const s=activeWeeks.get(a.group_id)||new Set();s.add(weekOf(a.at));activeWeeks.set(a.group_id,s)}
 const rows:WeekRow[]=[];
 for(const s of starts){const e=new Date(s.getTime()+7*DAY);
  const c=(await d.query<{calls:number;picks:number;slots:number;settled:number}>(`SELECT
    (SELECT count(*)::int FROM questions q JOIN groups g ON g.id=q.group_id WHERE ${real} AND q.created_at>=$1 AND q.created_at<$2) calls,
    (SELECT count(*)::int FROM predictions p JOIN questions q ON q.id=p.question_id JOIN groups g ON g.id=q.group_id WHERE ${real} AND p.submitted_at>=$1 AND p.submitted_at<$2) picks,
    (SELECT COALESCE(sum(GREATEST((SELECT count(*) FROM members m WHERE m.group_id=q.group_id AND m.active AND m.joined_at<q.locks_at)-CASE WHEN q.subject_id IS NULL THEN 0 ELSE 1 END,0)),0)::int FROM questions q JOIN groups g ON g.id=q.group_id WHERE ${real} AND q.locks_at>=$1 AND q.locks_at<$2) slots,
    (SELECT count(*)::int FROM predictions p JOIN questions q ON q.id=p.question_id JOIN groups g ON g.id=q.group_id WHERE ${real} AND q.locks_at>=$1 AND q.locks_at<$2) lockedPicks`,[s,e])).rows[0] as unknown as {calls:number;picks:number;slots:number;lockedpicks:number};
  const settled=(await d.query<{n:number}>(`SELECT count(*)::int n FROM questions q JOIN groups g ON g.id=q.group_id WHERE ${real} AND q.settled_at>=$1 AND q.settled_at<$2`,[s,e])).rows[0].n;
  const active=groups.filter(g=>activeWeeks.get(g.id)?.has(s.getTime())).length;
  rows.push({week:label(s),newGroups:groups.filter(g=>weekOf(g.started)===s.getTime()).length,activeGroups:active,calls:c.calls,picks:c.picks,
   pickRate:c.slots?Math.round(100*c.lockedpicks/c.slots):null,settled,callsPerActiveGroup:active?Math.round(10*c.calls/active)/10:null});
 }
 // Cohorts: groups that started in a week, and how many were still active 1, 2, 3, 4 weeks later.
 const cohorts:Cohort[]=starts.map(s=>{const born=groups.filter(g=>weekOf(g.started)===s.getTime());
  return{week:label(s),groups:born.length,active:[1,2,3,4].map(k=>{const w=s.getTime()+k*7*DAY;if(w>weekStartIstanbul(now).getTime())return null;return born.length?Math.round(100*born.filter(g=>activeWeeks.get(g.id)?.has(w)).length/born.length):null})}});
 // Calls past their time that nobody has settled: the thing that quietly kills a group.
 const unsettled=(await d.query<{group_id:string;n:number}>(`SELECT q.group_id,count(*)::int n FROM questions q JOIN groups g ON g.id=q.group_id WHERE ${real} AND q.state IN ('open','locked','proposed','disputed') AND COALESCE(q.event_at,q.locks_at)<$1 GROUP BY 1`,[new Date(now.getTime()-DAY)])).rows;
 const recent=(await d.query<{group_id:string;calls:number;picks:number;callers:number;last:Date|null}>(`SELECT g.id group_id,
   (SELECT count(*)::int FROM questions q WHERE q.group_id=g.id AND q.created_at>=$1) calls,
   (SELECT count(*)::int FROM predictions p JOIN questions q ON q.id=p.question_id WHERE q.group_id=g.id AND p.submitted_at>=$1) picks,
   (SELECT count(DISTINCT q.creator)::int FROM questions q WHERE q.group_id=g.id AND q.created_at>=$1) callers,
   (SELECT max(m.last_active_at) FROM members m WHERE m.group_id=g.id) last
  FROM groups g WHERE ${real}`,[new Date(now.getTime()-7*DAY)])).rows;
 const byId=new Map(recent.map(r=>[r.group_id,r])),open=new Map(unsettled.map(u=>[u.group_id,u.n]));
 const list:GroupRow[]=groups.map(g=>{const r=byId.get(g.id);return{name:g.name,members:g.members,started:label(new Date(g.started)),calls7:r?.calls||0,picks7:r?.picks||0,callers7:r?.callers||0,lastActive:r?.last?new Date(r.last).toISOString():null,unsettled:open.get(g.id)||0}})
  .sort((a,b)=>b.calls7-a.calls7||b.picks7-a.picks7||(b.lastActive||'').localeCompare(a.lastActive||''));
 const totals={groups:groups.length,players:(await d.query<{n:number}>(`SELECT count(DISTINCT m.user_id)::int n FROM members m JOIN groups g ON g.id=m.group_id WHERE ${real} AND m.active`)).rows[0].n,
  activeThisWeek:list.filter(g=>g.calls7+g.picks7>0).length,unsettled:unsettled.reduce((n,u)=>n+u.n,0)};
 return{generatedAt:now.toISOString(),totals,weeks:rows,cohorts,groups:list};
}
