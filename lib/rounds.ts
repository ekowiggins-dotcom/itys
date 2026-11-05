import {timingFor} from './timing';
import {randomUUID} from 'node:crypto';
import {nextStart,period,validAnswer,type GroupType} from './football/rules';
import {materialize} from './football/content';
import {emitNotification} from './notifications';
import type {Transaction} from '@electric-sql/pglite';
export const DAY=86400000;
export type Round={group_type:GroupType;timezone:string;leagues:number[];pick_end_at:Date;fixture_end_at:Date;content_ready:boolean;skip_reason:string|null;id:string;group_id:string;opens_at:Date;deadline_at:Date;publish_at:Date;state:string;provisional_published:boolean;finalized_at:Date|null};
export function nextMonday(date:Date){const next=new Date(date);next.setUTCHours(0,0,0,0);next.setUTCDate(next.getUTCDate()+((8-next.getUTCDay())%7||7));return next;}
export async function roundEvent(tx:Transaction,r:Round,kind:string,text:string,at:Date,processingNow=at){const recipients=await tx.query<{user_id:string}>(`INSERT INTO round_events SELECT $1,m.user_id,$2,$3,$4 FROM members m WHERE m.group_id=$5 AND m.active ON CONFLICT DO NOTHING RETURNING user_id`,[r.id,kind,text,at,r.group_id]);
 // Groups made with the new setup have no weeks to announce: no "new week", no weekly winner (they get the Oracle of the month).
 const weekless=r.group_type==='Friends'&&(await tx.query<{instant:boolean}>('SELECT instant FROM groups WHERE id=$1',[r.group_id])).rows[0]?.instant;
 if(!weekless&&(kind==='round-open'&&processingNow<new Date(r.deadline_at)||kind==='final'&&r.group_type==='Friends'))for(const m of recipients.rows)await emitNotification(tx,{groupId:r.group_id,userId:m.user_id,key:'round:'+r.id+':'+kind,kind:kind==='final'?'weekly_final':'round_open',roundId:r.id,text,eventAt:at},processingNow);
}
export async function ensureRounds(tx:Transaction,groupId:string,now:Date){
 let g=(await tx.query<{instant:boolean;practice:boolean;opens_at:Date|null;next_round_at:Date|null;group_type:GroupType;timezone:string;leagues:number[];pending_settings:{groupType:GroupType;timezone:string;leagues:number[];country:string}|null}>('SELECT instant,practice,opens_at,next_round_at,group_type,timezone,leagues,pending_settings FROM groups WHERE id=$1',[groupId])).rows[0];
 if(!g.opens_at)return;
 if(!(await tx.query('SELECT 1 FROM seasons WHERE group_id=$1',[groupId])).rows.length)await tx.query('INSERT INTO seasons(id,group_id,name,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),groupId,'Pilot season · 8 weeks',g.opens_at,new Date(new Date(g.opens_at).getTime()+56*DAY)]);
 let cursor=new Date(g.next_round_at||g.opens_at);
 // Initial legacy questions belong to the first period, never to a later live round.
 let first=(await tx.query<Round>('SELECT * FROM rounds WHERE group_id=$1 AND opens_at=$2',[groupId,g.opens_at])).rows[0];
 const unassigned=Number((await tx.query<{count:string}>("SELECT count(*) FROM questions WHERE group_id=$1 AND scope='weekly' AND round_id IS NULL",[groupId])).rows[0].count);
 if(unassigned&&!first){first=await insertRound(tx,groupId,new Date(g.opens_at!));}
 if(first&&unassigned>0){await tx.query("UPDATE questions SET round_id=$1,event_at=COALESCE(event_at,$2) WHERE group_id=$3 AND scope='weekly' AND round_id IS NULL",[first.id,first.deadline_at,groupId]);await tx.query('INSERT INTO round_members SELECT $1,user_id FROM round_eligibility WHERE group_id=$2 ON CONFLICT DO NOTHING',[first.id,groupId]);}
 let loops=0;
 while(cursor.getTime()<=now.getTime()&&loops++<2600){
 if(g.pending_settings){const settings=g.pending_settings;await tx.query('UPDATE groups SET group_type=$2,timezone=$3,leagues=$4,country=$5,pending_settings=NULL WHERE id=$1',[groupId,settings.groupType,settings.timezone,JSON.stringify(settings.leagues),settings.country]);g={...g,group_type:settings.groupType,timezone:settings.timezone,leagues:settings.leagues,pending_settings:null};}
 const count=Number((await tx.query<{count:string}>('SELECT count(DISTINCT user_id) FROM membership_periods WHERE group_id=$1 AND joined_at<=$2 AND (left_at IS NULL OR left_at>$2)',[groupId,cursor])).rows[0].count);
 const season=(await tx.query('SELECT id FROM seasons WHERE group_id=$1 AND starts_at<=$2 AND ends_at>$2',[groupId,cursor])).rows.length;
 const legacy=(await tx.query<Round>('SELECT * FROM rounds WHERE group_id=$1 AND opens_at=$2',[groupId,cursor])).rows[0];
 // Groups made with the new setup start straight away with whoever is in; older groups waited for three.
 const min=g.instant?1:3;
 if((count>=min&&season)||(legacy&&legacy.state!=='planned')||(legacy&&legacy.id===first?.id&&unassigned>0)){
 const r=legacy||await insertRound(tx,groupId,cursor);
 await tx.query('INSERT INTO round_members SELECT $1,user_id FROM membership_periods WHERE group_id=$2 AND joined_at<=$3 AND (left_at IS NULL OR left_at>$3) ON CONFLICT DO NOTHING',[r.id,groupId,cursor]);
 if(r.state==='planned')await tx.query("UPDATE rounds SET state=$2 WHERE id=$1",[r.id,r.group_type==='Friends'?'live':'waiting_feed']);
 await materialize(tx,{...r,state:r.group_type==='Friends'?'live':'waiting_feed'},now);
 const opened=(await tx.query<Round>('SELECT * FROM rounds WHERE id=$1',[r.id])).rows[0];if(opened.state==='live')await roundEvent(tx,r,'round-open',await openText(tx,opened),cursor,now);
 }else if(legacy&&legacy.state==='planned'){
 await tx.query('DELETE FROM round_members WHERE round_id=$1',[legacy.id]);await tx.query('DELETE FROM rounds WHERE id=$1',[legacy.id]);
 }
 cursor=period(cursor,g.group_type,g.timezone,g.practice).next;
 }
 const waiting=(await tx.query<Round>("SELECT * FROM rounds WHERE group_id=$1 AND state='waiting_feed'",[groupId])).rows;for(const r of waiting){await materialize(tx,r,now);const updated=(await tx.query<Round>('SELECT * FROM rounds WHERE id=$1',[r.id])).rows[0];if(updated.state==='live')await roundEvent(tx,updated,'round-open',await openText(tx,updated),now,now);}
 await tx.query('UPDATE groups SET next_round_at=$1 WHERE id=$2',[cursor,groupId]);
 // Show a scheduled first round without allowing bets until its opening.
 if(new Date(g.opens_at!)>now){
 const members=Number((await tx.query<{count:string}>('SELECT count(*) FROM members WHERE group_id=$1 AND active',[groupId])).rows[0].count);
 if(members>=(g.instant?1:3))await insertRound(tx,groupId,new Date(g.opens_at!));
 }
}
/** New-week message. Football weeks also say who won last week, so Thursday noon is one notification, not two. */
async function openText(tx:Transaction,r:Round){
 if(r.group_type==='Friends')return 'A new week of calls is open. Make yours.';
 const last=(await weeklyViews(tx,r.group_id)).find(v=>v.id!==r.id&&v.state==='final'&&new Date(v.opens_at)<new Date(r.opens_at));
 const winners=last?.winners.map(w=>w.name)||[];
 return (winners.length?'Last week: '+winners.slice(0,2).join(' & ')+(winners.length>1?' shared the win. ':' won. '):'')+'New matches are in. Make your calls.';
}
async function insertRound(tx:Transaction,g:string,at:Date){
 const settings=(await tx.query<{practice:boolean;group_type:GroupType;timezone:string;leagues:number[];pending_settings:{groupType:GroupType;timezone:string;leagues:number[]}|null}>('SELECT practice,group_type,timezone,leagues,pending_settings FROM groups WHERE id=$1',[g])).rows[0];
 const type=settings.pending_settings?.groupType||settings.group_type,zone=settings.pending_settings?.timezone||settings.timezone,leagues=settings.pending_settings?.leagues||settings.leagues;const dates=period(at,type,zone,settings.practice);
 const id=randomUUID();await tx.query('INSERT INTO rounds(id,group_id,opens_at,deadline_at,publish_at,group_type,timezone,leagues,pick_end_at,fixture_end_at,content_ready) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING',[id,g,at,dates.deadline,dates.publish,type,zone,JSON.stringify(leagues),dates.pickEnd,dates.fixtureEnd,type==='Friends']);
 return (await tx.query<Round>('SELECT * FROM rounds WHERE group_id=$1 AND opens_at=$2',[g,at])).rows[0];
}
export async function snapshot(tx:Transaction,q:{id:string;locks_at:Date;subject_id:string|null;scope:string;market?:string;options?:string[]|null},now:Date){
 if(new Date(q.locks_at)>now)return;
 if((await tx.query('SELECT 1 FROM lock_snapshots WHERE question_id=$1',[q.id])).rows.length)return;
 const picks=(await tx.query<{user_id:string;answer:string;stake:number}>(`SELECT p.user_id,p.answer,p.stake FROM predictions p WHERE p.question_id=$1 AND ($2::text IS NULL OR p.user_id<>$2) AND p.stake>=5 AND p.stake<=30 AND p.stake%5=0 AND ($3<>'longterm' OR p.stake=10)`,[q.id,q.subject_id,q.scope])).rows.filter(p=>validAnswer(q.market||'custom',p.answer,q.options));
 await tx.query('INSERT INTO lock_snapshots VALUES($1,$2,$3)',[q.id,q.locks_at,picks.length]);
 for(const p of picks)await tx.query('INSERT INTO locked_predictions VALUES($1,$2,$3,$4)',[q.id,p.user_id,p.answer,p.stake]);
}
export async function finalizeRounds(tx:Transaction,g:string,now:Date){
 const t=timingFor((await tx.query<{practice:boolean}>('SELECT practice FROM groups WHERE id=$1',[g])).rows[0]?.practice);
 const rounds=(await tx.query<Round>("SELECT * FROM rounds WHERE group_id=$1 AND state NOT IN ('final','skipped','planned') ORDER BY opens_at",[g])).rows;
 for(const r of rounds){
 const counts=(await tx.query<{total:string;pending:string}>("SELECT count(*) total,count(*) FILTER(WHERE state NOT IN ('settled','void')) pending FROM questions WHERE round_id=$1 AND NOT superseded",[r.id])).rows[0];
 if(r.group_type==='Friends'&&now.getTime()>=new Date(r.opens_at).getTime()+t.suggestionMs&&Number(counts.total)===0&&now<=new Date(r.deadline_at))await roundEvent(tx,r,'suggestion','No calls yet. Try: Will everyone arrive on time this weekend?',new Date(new Date(r.opens_at).getTime()+t.suggestionMs));
 if(now<new Date(r.publish_at))continue;
 if(!r.provisional_published){await tx.query('UPDATE rounds SET provisional_published=true WHERE id=$1',[r.id]);await roundEvent(tx,r,'provisional','Provisional standings are published. Pending results can still change the ranking.',new Date(r.publish_at));}
 if(Number(counts.total)===0){await tx.query("UPDATE rounds SET state='skipped',skip_reason=CASE WHEN content_ready THEN skip_reason ELSE 'Fixture feed unavailable' END,finalized_at=$2 WHERE id=$1",[r.id,now]);continue;}
 const final=Number(counts.pending)===0;
 await tx.query("UPDATE rounds SET state=$1,finalized_at=CASE WHEN $1='final' THEN $2::timestamptz ELSE NULL END WHERE id=$3",[final?'final':'provisional',now,r.id]);
 if(final){const result=(await weeklyViews(tx,g)).find(v=>v.id===r.id)!;const names=result.winners.slice(0,3).map(w=>w.name).join(' & ')+(result.winners.length>3?' and others':'');const text=names?`${names} ${result.winners.length>1?'are this week’s oracles':'is this week’s oracle'} with ${(result.winners[0].points_tenths/10).toFixed(1)} points.`:'The weekly standings are final.';await roundEvent(tx,r,'final',text,now);}
 }
}
export {rankStandings} from './rules';
import {rankStandings,type Standing} from './rules';
export async function weeklyViews(tx:Transaction,g:string){
 const rounds=(await tx.query<Round>('SELECT * FROM rounds WHERE group_id=$1 ORDER BY opens_at DESC',[g])).rows;
 const views=[];
 for(const r of rounds){
 const rows=(await tx.query<Omit<Standing,'rank'>>(`SELECT rm.user_id,u.name,m.active,COALESCE(round(sum(s.points_value)*10),0)::int points_tenths,COALESCE(sum(s.exact_correct),0)::int exact_correct FROM round_members rm JOIN users u ON u.id=rm.user_id JOIN members m ON m.group_id=$2 AND m.user_id=rm.user_id LEFT JOIN questions q ON q.round_id=rm.round_id AND NOT q.superseded LEFT JOIN scores s ON s.question_id=q.id AND s.user_id=rm.user_id WHERE rm.round_id=$1 GROUP BY rm.user_id,u.name,m.active`,[r.id,g])).rows;
 const standings=rankStandings(rows);
 const pending=Number((await tx.query<{count:string}>("SELECT count(*) FROM questions WHERE round_id=$1 AND state NOT IN ('settled','void')",[r.id])).rows[0].count);
 views.push({...r,pending,standings,winners:r.state==='final'?standings.filter(s=>s.rank===1&&s.points_tenths>0):[]});
 }
 return views;
}
