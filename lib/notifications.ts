import {NORMAL,type Timing} from './timing';
import {nextThursdayNoon,shifted} from './football/rules';
import {randomUUID} from 'node:crypto';import type {Transaction} from '@electric-sql/pglite';
import {defaultPreferences,notificationPolicy,weekStartUTC,type NotificationKind,type NotificationPreferences} from './notification-rules';
export async function emitNotification(tx:Transaction,input:{groupId:string;userId:string;key:string;kind:NotificationKind;text:string;questionId?:string;roundId?:string;eventAt?:Date},now:Date){
 // Serializes deduplication and the shared per-recipient/group calendar-week cap.
 await tx.query('SELECT id FROM groups WHERE id=$1 FOR UPDATE',[input.groupId]);
 if((await tx.query('SELECT id FROM notifications WHERE group_id=$1 AND user_id=$2 AND source_key=$3',[input.groupId,input.userId,input.key])).rows.length)return;
 const active=(await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[input.groupId,input.userId])).rows.length;if(!active)return;
 const prefs=(await tx.query<NotificationPreferences>('SELECT muted,round_open,lock_reminder,weekly_final FROM notification_preferences WHERE group_id=$1 AND user_id=$2',[input.groupId,input.userId])).rows[0]||defaultPreferences;
 const week=weekStartUTC(now);await tx.query('INSERT INTO notification_counters(group_id,user_id,week_start) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[input.groupId,input.userId,week]);
 const count=(await tx.query<{routine_count:number}>('SELECT routine_count FROM notification_counters WHERE group_id=$1 AND user_id=$2 AND week_start=$3 FOR UPDATE',[input.groupId,input.userId,week])).rows[0].routine_count;
 const policy=notificationPolicy(input.kind,prefs,count);
 await tx.query('INSERT INTO notifications(id,group_id,user_id,source_key,kind,category,question_id,round_id,text,event_at,created_at,in_app,push_eligible,suppressed_reason,push_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[randomUUID(),input.groupId,input.userId,input.key,input.kind,policy.category,input.questionId||null,input.roundId||null,input.text,input.eventAt||now,now,policy.inApp,policy.pushEligible,policy.reason,policy.pushEligible?'queued':'not_eligible']);
 if(policy.category==='routine'&&policy.inApp)await tx.query('UPDATE notification_counters SET routine_count=routine_count+1 WHERE group_id=$1 AND user_id=$2 AND week_start=$3',[input.groupId,input.userId,week]);
}
/** "Ege and Can made their call on Fenerbahçe – Liverpool. What’s yours?" Friends, not the clock, do the nudging. */
export function nudgeText(friends:string[],calls:string[]){
 const who=friends.length<=2?friends.join(' and '):friends.slice(0,2).join(', ')+' and '+(friends.length-2)+' more';
 if(calls.length===1)return `${who} made ${friends.length===1?'a call':'their calls'} on ${calls[0]}. What’s yours?`;
 return `${who} ${friends.length===1?'is':'are'} waiting on your calls: ${calls[0]} and ${calls.length-1} more.`;
}
/** Shortly before a call locks: if friends have made their call and you haven't, they nudge you. One per person per round and day. */
export async function lockReminders(tx:Transaction,g:string,now:Date,t:Timing=NORMAL){
 const soon=new Date(now.getTime()+t.lockReminderMs);
 const rows=(await tx.query<{user_id:string;round_id:string;question_id:string;title:string;timezone:string;friends:string[]}>(`SELECT m.user_id,q.round_id,q.id question_id,COALESCE(f.home||' – '||f.away,q.text) title,COALESCE(r.timezone,'UTC') timezone,
   (SELECT COALESCE(json_agg(u.name ORDER BY p.submitted_at),'[]') FROM predictions p JOIN users u ON u.id=p.user_id WHERE p.question_id=q.id AND p.user_id<>m.user_id) friends
  FROM questions q JOIN rounds r ON r.id=q.round_id AND r.state='live' LEFT JOIN football_fixtures f ON f.id=q.fixture_id
  JOIN members m ON m.group_id=q.group_id AND m.active
  WHERE q.group_id=$1 AND q.state='open' AND NOT q.superseded AND q.moderation_state='visible' AND q.locks_at>$2 AND q.locks_at<=$3 AND (q.subject_id IS NULL OR q.subject_id<>m.user_id)
   AND NOT EXISTS(SELECT 1 FROM predictions p WHERE p.question_id=q.id AND p.user_id=m.user_id)
  ORDER BY q.locks_at,q.id`,[g,now,soon])).rows;
 const byUser=new Map<string,typeof rows>();for(const r of rows){if(!r.friends.length)continue;const k=r.user_id+'|'+r.round_id;byUser.set(k,[...(byUser.get(k)||[]),r])}
 for(const list of byUser.values()){const first=list[0];const day=new Intl.DateTimeFormat('en-CA',{timeZone:first.timezone}).format(now);
  const friends=[...new Set(list.flatMap(r=>r.friends))];
  await emitNotification(tx,{groupId:g,userId:first.user_id,key:'nudge:'+first.round_id+':'+day,kind:'lock_reminder',roundId:first.round_id,questionId:list.length===1?first.question_id:undefined,text:nudgeText(friends,list.map(r=>r.title))},now);}
}
/** Saturday 12:00 (group time): a nudge for football weeks if you still have weekend matches to pick. */
export async function weekendReminders(tx:Transaction,g:string,now:Date){
 const rounds=(await tx.query<{id:string;opens_at:Date;timezone:string}>("SELECT id,opens_at,timezone FROM rounds WHERE group_id=$1 AND state='live' AND group_type<>'Friends'",[g])).rows;
 for(const r of rounds){
  const anchor=nextThursdayNoon(new Date(new Date(r.opens_at).getTime()-7*86400000),r.timezone),saturday=shifted(anchor,2,12,0,r.timezone);
  if(saturday<new Date(r.opens_at)||now<saturday||now.getTime()>saturday.getTime()+3*3600000)continue;
  const until=new Date(saturday.getTime()+36*3600000);
  const rows=(await tx.query<{user_id:string;left:number;first:Date}>(`SELECT m.user_id,count(q.id)::int "left",min(q.locks_at) first FROM members m JOIN questions q ON q.round_id=$2 AND q.state='open' AND q.locks_at>$3 AND q.locks_at<=$4 AND (q.subject_id IS NULL OR q.subject_id<>m.user_id) AND NOT EXISTS(SELECT 1 FROM predictions p WHERE p.question_id=q.id AND p.user_id=m.user_id) WHERE m.group_id=$1 AND m.active GROUP BY m.user_id`,[g,r.id,now,until])).rows;
  for(const m of rows){
   await emitNotification(tx,{groupId:g,userId:m.user_id,key:'round:'+r.id+':saturday',kind:'lock_reminder',roundId:r.id,text:`Weekend matches are on. ${m.left} still ${m.left===1?'needs':'need'} your call.`,eventAt:saturday},now);}
 }
}
export async function notificationView(tx:Transaction,g:string,u:string,now:Date){
 const preferences=(await tx.query<NotificationPreferences>('SELECT muted,round_open,lock_reminder,weekly_final FROM notification_preferences WHERE group_id=$1 AND user_id=$2',[g,u])).rows[0]||defaultPreferences;
 const inbox=(await tx.query('SELECT id,kind,category,text,question_id,round_id,created_at,read_at,push_eligible,push_status FROM notifications WHERE group_id=$1 AND user_id=$2 AND in_app ORDER BY created_at DESC,id DESC LIMIT 100',[g,u])).rows;
 const count=(await tx.query<{routine_count:number}>('SELECT routine_count FROM notification_counters WHERE group_id=$1 AND user_id=$2 AND week_start=$3',[g,u,weekStartUTC(now)])).rows[0]?.routine_count||0;
 const suppressed=(await tx.query<{count:string}>('SELECT count(*) FROM notifications WHERE group_id=$1 AND user_id=$2 AND NOT in_app AND created_at >= $3::date',[g,u,weekStartUTC(now)])).rows[0].count;
 return{notificationPreferences:preferences,notifications:inbox,notificationUsage:{routineCount:count,cap:4,weekStart:weekStartUTC(now),suppressed:Number(suppressed),pushConnected:(await tx.query('SELECT 1 FROM devices WHERE user_id=$1 AND disabled_at IS NULL LIMIT 1',[u])).rows.length>0}};
}
