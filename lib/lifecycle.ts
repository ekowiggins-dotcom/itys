import {announceOracle} from './rankings';
import {createMoment,addMomentCall,sealedUntil} from './moments';
import {friendOptions,assignResolver} from './friends';
import {moderationAction,moderationActions,touchMember,maintainRecovery} from './moderation';
import {exactOutcome,marketAnswer,localSunday,customAnswers,cleanOptions,type Fixture} from './football/rules';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { z } from 'zod';
import type { Transaction } from '@electric-sql/pglite';
import {maintainSeasons} from './seasons';
import {NORMAL,PRACTICE_ROUND,timingFor,type Timing} from './timing';
import {emitNotification,lockReminders,weekendReminders} from './notifications';
import {ensureRounds,snapshot,finalizeRounds} from './rounds';
export {scoreTenths} from './rules';import {callPoints} from './rules';
import {disputeCutoff} from './rules';
const DAY=86400000;
export class LifecycleError extends Error {}
function check(ok:unknown,message:string):asserts ok{if(!ok)throw new LifecycleError(message)}
type Question={moment_id?:string|null;moderation_state:string;market:string;fixture_id:string|null;result_revision:string|null;void_reason:string|null;round_id:string|null;id:string;group_id:string;creator:string;scope:string;locks_at:Date;event_at:Date|null;subject_id:string|null;resolver_id?:string|null;text:string;state:string;proposed_answer:string|null;proposed_at:Date|null;proposed_by:string|null;options:string[]|null;settled_at:Date|null;slot?:string|null};
export function deadline(q:{event_at:Date|null;scope:string},opens:Date|null,t:Timing=NORMAL){return q.event_at?new Date(q.event_at).getTime()+t.resolutionMs:new Date(opens!).getTime()+(t.practice?PRACTICE_ROUND.lockByMs+t.resolutionMs:14*DAY-60000)}
async function audit(tx:Transaction,g:string,q:string|null,u:string|null,action:string,now:Date,details:unknown=null){await tx.query('INSERT INTO audit(id,group_id,question_id,actor_id,action,created_at,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),g,q,u,action,now,JSON.stringify(details)])}
async function alert(tx:Transaction,q:Question,stage:string,actor:string|null,now:Date,processingNow=now){
 // Essential competition alerts never consult blocks or group mute preferences.
 const recipients=await tx.query<{user_id:string}>(`INSERT INTO alerts SELECT gen_random_uuid()::text,$1,$2,p.user_id,$3,true,$4,$5 FROM predictions p WHERE p.question_id=$2 ON CONFLICT(question_id,user_id,stage) DO NOTHING RETURNING user_id`,[q.group_id,q.id,stage,actor,now]);
 const kind=stage==='proposed'?'proposal':stage==='disputed'?'dispute':'settlement';
 const text=(stage==='proposed'?'The result’s in: ':stage==='disputed'?'Someone said that’s not right: ':'Final result: ')+q.text;
 for(const m of recipients.rows)await emitNotification(tx,{groupId:q.group_id,userId:m.user_id,key:'bet:'+q.id+':'+stage,kind,questionId:q.id,roundId:q.round_id||undefined,text,eventAt:now},processingNow);
}
async function settle(tx:Transaction,q:Question,answer:string|null,now:Date,processingNow=now,fixture?:Fixture){
 if(answer===null&&new Date(q.locks_at)>now){q.locks_at=now;await tx.query('UPDATE questions SET locks_at=$2 WHERE id=$1',[q.id,now]);}
 await snapshot(tx,q,now);
 const predictions=(await tx.query<{user_id:string;answer:string;stake:number;forfeited:boolean}>('SELECT lp.*,COALESCE(p.forfeited,false) forfeited FROM locked_predictions lp LEFT JOIN predictions p ON p.question_id=lp.question_id AND p.user_id=lp.user_id WHERE lp.question_id=$1',[q.id])).rows;
 const long=q.scope==='longterm';
 const scoreDate=long?now:(await tx.query<{opens_at:Date}>('SELECT opens_at FROM rounds WHERE id=$1',[q.round_id])).rows[0]?.opens_at||now;
 const season=(await tx.query<{id:string}>('SELECT id FROM seasons WHERE group_id=$1 AND starts_at<=$2 AND ends_at>$2',[q.group_id,scoreDate])).rows[0];
 for(const p of predictions){
 const same=predictions.filter(x=>x.answer===p.answer).length;
 const voided=answer===null,correct=answer===p.answer;
 const exact=q.market==='exact_score'&&fixture&&fixture.home90!==null&&fixture.away90!==null?exactOutcome(p.answer,fixture.home90,fixture.away90):{exact:false,partial:false};
 // Points are set now, from how the group split at the lock. Wrong, called off or forfeited: 0.
 const value=p.forfeited||voided||!correct?0:callPoints({same,total:predictions.length});
 const numeric={value:String(value),tenths:value*10};
 if(fixture){const old=(await tx.query<{points_value:string}>('SELECT points_value FROM scores WHERE question_id=$1 AND user_id=$2',[q.id,p.user_id])).rows[0];await tx.query('INSERT INTO football_score_revisions VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[randomUUID(),q.id,p.user_id,fixture.revision,old?.points_value||null,numeric.value,processingNow]);}
 const sql='INSERT INTO scores(question_id,user_id,points_tenths,settled_at,season_id,allocation,expires_at,points_value,exact_correct) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) '+(fixture?'ON CONFLICT(question_id,user_id) DO UPDATE SET points_tenths=EXCLUDED.points_tenths,points_value=EXCLUDED.points_value,exact_correct=EXCLUDED.exact_correct,settled_at=EXCLUDED.settled_at':'ON CONFLICT DO NOTHING');
 await tx.query(sql,[q.id,p.user_id,numeric.tenths,now,season?.id||null,long?(season?'credited':'pending'):'weekly',long&&!season?new Date(now.getTime()+30*DAY):null,numeric.value,!voided&&!p.forfeited&&exact.exact?1:0]);
 }
 await tx.query('UPDATE questions SET state=$1,settled_at=$2,result_answer=$4 WHERE id=$3',[answer===null?'void':'settled',now,q.id,answer]);
 if(fixture){await tx.query('UPDATE questions SET result_revision=$2 WHERE id=$1',[q.id,fixture.revision]);if(q.state==='settled'&&q.result_revision!==fixture.revision){const users=(await tx.query<{user_id:string}>('SELECT user_id FROM predictions WHERE question_id=$1',[q.id])).rows;for(const u of users)await emitNotification(tx,{groupId:q.group_id,userId:u.user_id,key:'correction:'+q.id+':'+fixture.revision,kind:'match_change',questionId:q.id,roundId:q.round_id||undefined,text:'A provider correction updated the 90-minute result and your score: '+q.text},processingNow);}}
 await alert(tx,q,'settled',null,now,processingNow);
 // The person a call was about finally gets to see it.
 if(q.subject_id){const said=answer===null?'called off':'it was '+(answer==='yes'?'Yes':answer==='no'?'No':answer);await emitNotification(tx,{groupId:q.group_id,userId:q.subject_id,key:'about:'+q.id+':settled',kind:'about_you',questionId:q.id,roundId:q.round_id||undefined,text:'The secret call about you: “'+q.text+'” · '+said+'.'},processingNow);}
 await audit(tx,q.group_id,q.id,null,answer===null?'void':'settled',now,{answer,revision:fixture?.revision||null});
}
export async function maintain(tx:Transaction,group:{id:string;opens_at:Date|null},now:Date){
 const t=timingFor((await tx.query<{practice:boolean}>('SELECT practice FROM groups WHERE id=$1',[group.id])).rows[0]?.practice);
 await maintainRecovery(tx,group.id,now);
 await ensureRounds(tx,group.id,now);
 const zone=(await tx.query<{timezone:string}>('SELECT timezone FROM groups WHERE id=$1',[group.id])).rows[0]?.timezone||'Europe/Istanbul';
 await announceOracle(tx,{id:group.id,timezone:zone},now);
 const qs=(await tx.query<Question>("SELECT * FROM questions WHERE group_id=$1 AND NOT superseded AND (state NOT IN ('settled','void') OR fixture_id IS NOT NULL)",[group.id])).rows;
 for(const q of qs){
 if(q.fixture_id){
 const f=(await tx.query<Fixture>('SELECT * FROM football_fixtures WHERE id=$1',[q.fixture_id])).rows[0];if(!f)continue;
 const r=(await tx.query<{state:string;fixture_end_at:Date}>('SELECT state,fixture_end_at FROM rounds WHERE id=$1',[q.round_id])).rows[0];
 if(['final','skipped'].includes(r.state)||q.state==='void'){if(q.result_revision&&q.result_revision!==f.revision)await tx.query('INSERT INTO football_review_flags VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[q.id,f.revision,'Provider changed a final or void result; no automatic rewrite',now]);continue;}
 if(q.state==='settled'&&q.result_revision===f.revision)continue;
 const kick=new Date(f.kickoff),oldLock=new Date(q.locks_at);const lock=oldLock<=now?new Date(Math.min(oldLock.getTime(),kick.getTime())):kick;
 await tx.query('UPDATE questions SET locks_at=$2,event_at=$3 WHERE id=$1',[q.id,lock,kick]);q.locks_at=lock;q.event_at=kick;
 await snapshot(tx,q,now);
 const cutoff=deadline(q,group.opens_at,t),voided=f.status==='void'||kick>=new Date(r.fixture_end_at)||now.getTime()>=cutoff;
 if(voided){await tx.query('UPDATE questions SET void_reason=$2 WHERE id=$1',[q.id,f.status==='void'?'Postponed, abandoned or cancelled':kick>=new Date(r.fixture_end_at)?'Moved outside this round':'Resolution deadline reached']);await settle(tx,q,null,now,now,f);continue;}
 if(f.needs_review){await tx.query('INSERT INTO football_review_flags VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[q.id,f.revision,'Kickoff changed after predictions were submitted; timing review required',now]);continue;}
 if(f.status==='finished'&&now<kick)continue;
 if(f.status==='finished'&&f.home90!==null&&f.away90!==null)await settle(tx,q,marketAnswer(q.market,f.home90,f.away90),now,now,f);
 else if(q.state==='settled')await tx.query("UPDATE questions SET state='correction_pending' WHERE id=$1",[q.id]);
 continue;
 }
 await snapshot(tx,q,now);
 const cutoff=deadline(q,group.opens_at,t);
 // The dispute window closes at proposal+24h or the resolution deadline, whichever is first (rules.disputeCutoff).
 const settleAt=q.proposed_at?disputeCutoff(new Date(q.proposed_at).getTime(),cutoff,t.disputeMs):Infinity;
 if(q.moderation_state!=='pending'&&q.state==='proposed'&&now.getTime()>=settleAt)await settle(tx,q,q.proposed_answer,new Date(settleAt),now);
 else if(now.getTime()>=cutoff)await settle(tx,q,null,new Date(cutoff),now);
 }
 await lockReminders(tx,group.id,now,t);
 // Sealed predictions: everyone hears at the same moment that they're open.
 for(const m of (await tx.query<{id:string;title:string;opens_at:Date}>("SELECT id,title,opens_at FROM moments WHERE group_id=$1 AND sealed AND opens_at<=$2 AND opens_at>$2::timestamptz-interval '7 days'",[group.id,now])).rows)
  for(const u of (await tx.query<{user_id:string}>('SELECT user_id FROM members WHERE group_id=$1 AND active',[group.id])).rows)
   await emitNotification(tx,{groupId:group.id,userId:u.user_id,key:'opened:'+m.id,kind:'moment_open',text:`${m.title}: your sealed predictions are open. See what everyone said.`,eventAt:new Date(m.opens_at)},now);
 if(!t.practice)await weekendReminders(tx,group.id,now);
 await finalizeRounds(tx,group.id,now);
 await maintainSeasons(tx,group.id,now);
}
const schema=z.object({action:z.enum(['report','unblock','subjectRemoval','reviewRemoval','removeBet','appealRemoval','recoverAdmin','respondRecovery','leave','transfer','propose','dispute','judge','block','season','longterm','predictLongterm','judgeSettings','notificationPreferences','notificationRead','seasonNoticeRead','tick','startFirstWeek','addNames','createMoment','addMomentCall','setResolver']),invite:z.string(),questionId:z.string().optional(),answer:z.string().max(40).optional(),options:z.array(z.string().max(60)).max(4).optional(),answerType:z.enum(['choice','friend']).optional(),moment:z.unknown().optional(),momentId:z.string().max(64).optional(),call:z.unknown().optional(),names:z.array(z.string().trim().min(1).max(60)).max(29).optional(),name:z.string().trim().min(1).max(60).optional(),text:z.string().trim().min(3).max(240).optional(),locksAt:z.iso.datetime().optional(),eventAt:z.iso.datetime().optional(),startsAt:z.iso.datetime().optional(),endsAt:z.iso.datetime().optional(),targetId:z.string().optional(),reason:z.string().trim().min(3).max(1000).optional(),decision:z.enum(['restore','remove']).optional(),muted:z.boolean().optional(),roundOpen:z.boolean().optional(),lockReminder:z.boolean().optional(),weeklyFinal:z.boolean().optional(),notificationId:z.uuid().optional(),noticeId:z.uuid().optional(),subjectId:z.uuid().optional(),resolverId:z.uuid().optional()});
export async function lifecycle(input:unknown,userId:string,now=new Date()){
 const data=schema.parse(input),d=await db();
 // Commit due settlements independently of an action that may subsequently fail.
 await d.transaction(async tx=>{const g=(await tx.query<{id:string;opens_at:Date|null}>('SELECT id,opens_at FROM groups WHERE invite=$1 FOR UPDATE',[data.invite])).rows[0];if(g){await touchMember(tx,g.id,userId,now);await maintain(tx,g,now)}});
 return d.transaction(async tx=>{
 const g=(await tx.query<{id:string;admin:string;opens_at:Date|null;fallback_id:string|null;timezone:string;practice:boolean}>('SELECT * FROM groups WHERE invite=$1 FOR UPDATE',[data.invite])).rows[0];check(g,'Group not found.');const t=timingFor(g.practice);
 const member=(await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,userId])).rows.length;check(member,'Join this group first.');
 await maintain(tx,g,now);
 if(moderationActions.includes(data.action)){
 try{await moderationAction(tx,g,userId,data,now,async id=>{const q=(await tx.query<Question>('SELECT * FROM questions WHERE id=$1',[id])).rows[0];await settle(tx,q,null,now)});}catch(e){throw new LifecycleError(e instanceof Error?e.message:'Unable to moderate this call.')}
 }else if(data.action==='notificationPreferences'){
 await tx.query('INSERT INTO notification_preferences(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[g.id,userId]);
 await tx.query('UPDATE notification_preferences SET muted=COALESCE($3,muted),round_open=COALESCE($4,round_open),lock_reminder=COALESCE($5,lock_reminder),weekly_final=COALESCE($6,weekly_final) WHERE group_id=$1 AND user_id=$2',[g.id,userId,data.muted??null,data.roundOpen??null,data.lockReminder??null,data.weeklyFinal??null]);
 }else if(data.action==='notificationRead'){
 await tx.query('UPDATE notifications SET read_at=COALESCE(read_at,$3) WHERE group_id=$1 AND user_id=$2 AND in_app AND ($4::text IS NULL OR id=$4)',[g.id,userId,now,data.notificationId||null]);
 }else if(data.action==='seasonNoticeRead'){
 await tx.query('UPDATE season_drop_notices SET seen_at=COALESCE(seen_at,$3) WHERE user_id=$1 AND id=$2 AND season_id IN(SELECT id FROM seasons WHERE group_id=$4)',[userId,z.uuid().parse(data.noticeId),now,g.id]);
 }else if(data.action==='leave'){
 check(g.admin!==userId,'Transfer the admin role before leaving.');
 await tx.query('DELETE FROM predictions WHERE user_id=$1 AND question_id IN(SELECT id FROM questions WHERE group_id=$2 AND locks_at>$3)',[userId,g.id,now]);
 await tx.query("UPDATE predictions SET forfeited=true WHERE user_id=$1 AND question_id IN(SELECT id FROM questions WHERE group_id=$2 AND scope='longterm' AND locks_at<=$3 AND state NOT IN ('settled','void'))",[userId,g.id,now]);
 await tx.query('UPDATE members SET active=false WHERE group_id=$1 AND user_id=$2',[g.id,userId]);
 await tx.query('UPDATE membership_periods SET left_at=$3 WHERE group_id=$1 AND user_id=$2 AND left_at IS NULL',[g.id,userId,now]);
 }else if(data.action==='transfer'||data.action==='block'||data.action==='judgeSettings'){
 check(data.targetId&&data.targetId!==userId,'Choose another group member.');
 check((await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,data.targetId])).rows.length,'Member not found.');
 if(data.action==='judgeSettings'){check(g.admin===userId,'Only the admin can name a fallback judge.');await tx.query('UPDATE groups SET fallback_id=$1 WHERE id=$2',[data.targetId,g.id]);}
 else if(data.action==='transfer'){check(g.admin===userId,'Only the admin can transfer the role.');await tx.query('UPDATE groups SET admin=$1 WHERE id=$2',[data.targetId,g.id]);await maintainRecovery(tx,g.id,now);}
 else await tx.query('INSERT INTO blocks VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[g.id,userId,data.targetId]);
 }else if(data.action==='season'){
 check(g.admin===userId,'Only the admin can schedule seasons.');
 const start=new Date(z.iso.datetime().parse(data.startsAt)),end=new Date(z.iso.datetime().parse(data.endsAt));
 check(start>=now&&end>start,'Schedule a future season with an end after its start.');
 check(!(await tx.query('SELECT 1 FROM seasons WHERE group_id=$1 AND starts_at<$3 AND ends_at>$2',[g.id,start,end])).rows.length,'Season windows cannot overlap.');
 await tx.query('INSERT INTO seasons(id,group_id,name,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),g.id,data.name||'Next season',start,end]);
 await maintain(tx,g,now);
 }else if(data.action==='createMoment'){
 // A Moment: a few calls that close together when it starts. Moves no points (reviewed in tests/policy.test.ts).
 const made=await createMoment(tx,g,userId,data.moment,now,m=>{throw new LifecycleError(m)});
 await audit(tx,g.id,made.questionIds[0],userId,'moment created',now);return {invite:data.invite,momentId:made.momentId,questionId:made.questionIds[0]};
 }else if(data.action==='addMomentCall'){
 // Sealed predictions are written together until the seal date. Moves no points.
 const q=await addMomentCall(tx,g,userId,data.momentId,data.call,now,m=>{throw new LifecycleError(m)});
 await audit(tx,g.id,q,userId,'sealed call added',now);return {invite:data.invite,questionId:q};
 }else if(data.action==='addNames'){
 // Friends who aren't in yet, by first name: "who…?" calls can name them, and they claim the name when they join. Moves no points.
 const taken=new Set([...(await tx.query<{name:string}>('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.active',[g.id])).rows.map(r=>r.name),...((await tx.query<{pending_names:string[]}>('SELECT pending_names FROM groups WHERE id=$1',[g.id])).rows[0].pending_names||[])].map(n=>n.toLocaleLowerCase('tr')));
 const fresh=(data.names||[]).filter(n=>{const k=n.toLocaleLowerCase('tr');if(taken.has(k))return false;taken.add(k);return true});
 check(fresh.length,'Those names are already in the group.');
 await tx.query("UPDATE groups SET pending_names=(SELECT jsonb_agg(x) FROM (SELECT jsonb_array_elements(pending_names) x UNION ALL SELECT to_jsonb(n) FROM unnest($2::text[]) n) y) WHERE id=$1",[g.id,fresh.slice(0,29)]);
 }else if(data.action==='startFirstWeek'){
 // A new group doesn't have to wait for Monday (or Thursday for football): the admin can open a starter week now.
 // It ends with the regular week it falls in, so the normal rhythm follows. It moves no points.
 check(g.admin===userId,'Only the admin can start the first week early.');
 check(!g.practice,'Practice groups already run on a fast clock.');
 // A football week that closed because no matches were published yet can be opened again once they are.
 const empty=(await tx.query<{id:string;opens_at:Date}>("SELECT id,opens_at FROM rounds WHERE group_id=$1 AND state='skipped' AND skip_reason IN ('No league games','Feed arrived after all kickoffs') AND opens_at<=$2 AND pick_end_at>$2 ORDER BY opens_at DESC LIMIT 1",[g.id,now])).rows[0];
 if(empty&&!(g.opens_at&&new Date(g.opens_at)>now)){
  await tx.query("UPDATE rounds SET state='waiting_feed',skip_reason=NULL,finalized_at=NULL,content_ready=false WHERE id=$1",[empty.id]);
  await tx.query('DELETE FROM football_skipped_weeks WHERE group_id=$1 AND opens_at=$2',[g.id,empty.opens_at]);
  await maintain(tx,g,now);
  const r=(await tx.query<{state:string}>('SELECT state FROM rounds WHERE id=$1',[empty.id])).rows[0];check(r.state==='live','No published matches left before the next week. Add them at /admin, publish, then try again.');
 }else{
 check(g.opens_at&&new Date(g.opens_at)>now,'The first week has already started.');
 const active=Number((await tx.query<{count:string}>('SELECT count(*) FROM members WHERE group_id=$1 AND active',[g.id])).rows[0].count);check(active>=3,'Get three friends in first.');
 const old=new Date(g.opens_at!);
 await tx.query('UPDATE groups SET opens_at=$1,next_round_at=$1 WHERE id=$2',[now,g.id]);
 await tx.query('UPDATE seasons SET starts_at=$1 WHERE group_id=$2 AND starts_at=$3',[now,g.id,old]);
 g.opens_at=now;await maintain(tx,g,now);
 }
 }else if(data.action==='longterm'){
 const lock=new Date(z.iso.datetime().parse(data.locksAt)),event=new Date(z.iso.datetime().parse(data.eventAt));
 const sunday=t.practice?new Date(now.getTime()+t.longTermMinMs):localSunday(now,g.timezone);
 check(event>sunday,'Use a weekly call for events ending by this Sunday. Long-term calls must resolve later.');
 check(lock>now&&event>=lock,'Lock must be in the future and no later than the event deadline.');
 if(data.subjectId)check((await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,data.subjectId])).rows.length,'The tagged subject must be a member.');
 let options:string[]|null;try{options=data.answerType==='friend'?await friendOptions(tx,g.id):cleanOptions(data.options)}catch(e){throw new LifecycleError((e as Error).message)}
 const id=randomUUID();await tx.query('INSERT INTO questions(id,group_id,creator,text,locks_at,scope,event_at,subject_id,options,answer_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,g.id,userId,z.string().trim().min(3).max(240).parse(data.text),lock,'longterm',event,data.subjectId||null,options?JSON.stringify(options):null,data.answerType==='friend'?'friend':'choice']);
 if(data.subjectId)await emitNotification(tx,{groupId:g.id,userId:data.subjectId,key:'about:'+id,kind:'about_you',text:'Your friends made a call about you. You can see it, but not their answers until it’s settled.'},now);
 await assignResolver(tx,g.id,userId,id,data.resolverId);
 await audit(tx,g.id,id,userId,'longterm created',now);return {invite:data.invite,questionId:id};
 }else if(data.action!=='tick'){
 const q=(await tx.query<Question>('SELECT * FROM questions WHERE id=$1 AND group_id=$2 FOR UPDATE',[data.questionId,g.id])).rows[0];check(q,'Call not found.');
 const option=()=>{const a=data.answer||'';check(customAnswers(q.options).includes(a),'Choose one of this call’s options.');return a};check(q.moderation_state==='visible','This call is hidden pending moderation.');
 if(data.action==='setResolver'){
 // The admin hands a call to someone who'll know what happened. It only changes who reports the outcome; scoring is untouched.
 check(userId===g.admin,'Only the admin can choose who settles a call.');
 check(q.state==='open'&&!q.fixture_id,'This call already has a result.');
 const target=data.targetId&&data.targetId!==g.admin?data.targetId:null;
 if(target)check((await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,target])).rows.length,'Pick someone in the group.');
 await tx.query('UPDATE questions SET resolver_id=$1 WHERE id=$2',[target,q.id]);await audit(tx,g.id,q.id,userId,'resolver set',now,{resolver:target||g.admin});
 if(target)await emitNotification(tx,{groupId:g.id,userId:target,key:'resolver:'+q.id+':'+target,kind:'judgment_request',questionId:q.id,roundId:q.round_id||undefined,text:'You’ll say what happened: '+q.text},now);
 return {invite:data.invite,questionId:q.id};
 }else if(data.action==='predictLongterm'){
 check(q.subject_id!==userId,'The tagged person can’t predict on this call.');
 check(q.scope==='longterm'&&now<new Date(q.locks_at)&&q.state==='open','This long-term call is locked.');
 const existing=(await tx.query<{forfeited:boolean}>('SELECT forfeited FROM predictions WHERE question_id=$1 AND user_id=$2',[q.id,userId])).rows[0];check(!existing?.forfeited,'Forfeited predictions cannot be restored.');
 const count=Number((await tx.query<{count:string}>("SELECT count(*) FROM predictions p JOIN questions q ON q.id=p.question_id WHERE p.user_id=$1 AND q.scope='longterm' AND q.state NOT IN ('settled','void') AND NOT p.forfeited AND q.id<>$2 AND q.group_id=$3 AND q.moment_id IS NULL",[userId,q.id,g.id])).rows[0].count);check(q.moment_id||count<3,'You already have three open long-term predictions.');
 await tx.query('INSERT INTO predictions(question_id,user_id,answer,stake) VALUES($1,$2,$3,10) ON CONFLICT(question_id,user_id) DO UPDATE SET answer=EXCLUDED.answer',[q.id,userId,option()]);
 }else{
 check(!q.fixture_id,'Football questions resolve automatically from the data feed.');
 check(!['settled','void'].includes(q.state),'This call has already settled or reached its deadline.');
 check(now>=new Date(q.locks_at),'Wait until the call locks.');
 if(data.action==='propose'){
 // The admin says what happened, unless they handed the call to someone else. If that person has left, or is
 // late after the event, the admin can step in.
 const resolver=q.resolver_id||g.admin!,resolverActive=(await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,resolver])).rows.length;
 const event=q.event_at?new Date(q.event_at).getTime():new Date(g.opens_at!).getTime()+7*DAY-60000;
 // Sealed predictions: nobody settles them before the opening; after it, the group decides together, so anyone in it can.
 const opens=await sealedUntil(tx,q.id);if(opens)check(now>=opens,'These open on '+opens.toISOString().slice(0,10)+'.');
 check(!!opens||userId===resolver||(userId===g.admin&&(!resolverActive||now.getTime()>=event+t.takeoverMs)),'Only the person settling this call can say what happened.');
 check(q.state==='open','A proposal already exists.');
 if(!opens&&userId!==resolver)await audit(tx,g.id,q.id,userId,'admin takeover',now,{resolver});
 await tx.query("UPDATE questions SET state='proposed',proposed_answer=$1,proposed_at=$2,proposed_by=$4 WHERE id=$3",[option(),now,q.id,userId]);await alert(tx,q,'proposed',userId,now);
 }else if(data.action==='dispute'){
 check(q.proposed_at&&['proposed','disputed'].includes(q.state)&&now.getTime()<Math.min(new Date(q.proposed_at).getTime()+t.disputeMs,deadline(q,g.opens_at,t)),'The dispute window has closed.');
 check(!(await tx.query('SELECT 1 FROM disputes WHERE question_id=$1 AND user_id=$2',[q.id,userId])).rows.length,'You already disputed this call.');
 await tx.query('INSERT INTO disputes VALUES($1,$2,$3)',[q.id,userId,now]);await tx.query("UPDATE questions SET state='disputed' WHERE id=$1",[q.id]);await alert(tx,q,'disputed',userId,now);
 const judge=(await tx.query<{user_id:string}>(`SELECT m.user_id FROM members m WHERE m.group_id=$1 AND m.active AND m.user_id<>$2 AND ($3::text IS NULL OR m.user_id<>$3) AND m.user_id<>COALESCE($7::text,$2) AND NOT EXISTS(SELECT 1 FROM disputes di WHERE di.question_id=$4 AND di.user_id=m.user_id) ORDER BY (m.user_id=$5) DESC,(m.user_id=$6) DESC,m.joined_at,m.user_id LIMIT 1`,[g.id,q.creator,q.subject_id,q.id,g.admin,g.fallback_id,q.proposed_by])).rows[0];
 if(!judge)await settle(tx,q,null,now);
 else{const inserted=await tx.query('INSERT INTO alerts VALUES($1,$2,$3,$4,$5,true,$6,$7) ON CONFLICT(question_id,user_id,stage) DO NOTHING RETURNING id',[randomUUID(),g.id,q.id,judge.user_id,'judgment requested',userId,now]);if(inserted.rows.length)await emitNotification(tx,{groupId:g.id,userId:judge.user_id,key:'bet:'+q.id+':judgment',kind:'judgment_request',questionId:q.id,roundId:q.round_id||undefined,text:'You’re the judge: '+q.text},now);}
 }else if(data.action==='judge'){
 check(q.state==='disputed','No open dispute.');
 const judges=(await tx.query<{user_id:string}>(`SELECT m.user_id FROM members m WHERE m.group_id=$1 AND m.active AND m.user_id<>$2 AND ( $3::text IS NULL OR m.user_id<>$3 ) AND m.user_id<>COALESCE($7::text,$2) AND NOT EXISTS(SELECT 1 FROM disputes d WHERE d.question_id=$4 AND d.user_id=m.user_id) ORDER BY (m.user_id=$5) DESC,(m.user_id=$6) DESC,m.joined_at,m.user_id`,[g.id,q.creator,q.subject_id,q.id,g.admin,g.fallback_id,q.proposed_by])).rows;
 if(!judges.length)await settle(tx,q,null,now);else{check(judges[0].user_id===userId,'Only the eligible judge can decide.');await settle(tx,q,option(),now);}
 }
 }
 }
 await audit(tx,g.id,data.questionId||null,userId,data.action,now,{answer:data.answer||null,targetId:data.targetId||null});
 await finalizeRounds(tx,g.id,now);
 await maintainSeasons(tx,g.id,now);
 return {invite:data.invite};
 });
}
