import {NORMAL,type Timing} from './timing';
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
export async function lockReminders(tx:Transaction,g:string,now:Date,t:Timing=NORMAL){
 const rounds=(await tx.query<{id:string;first_lock:Date}>("SELECT r.id,min(q.locks_at) first_lock FROM rounds r JOIN questions q ON q.round_id=r.id WHERE r.group_id=$1 AND r.state='live' AND q.state<>'void' GROUP BY r.id",[g])).rows;
 for(const r of rounds){const lock=new Date(r.first_lock);if(now.getTime()<lock.getTime()-t.lockReminderMs||now>=lock)continue;
 const members=(await tx.query<{user_id:string}>(`SELECT m.user_id FROM members m WHERE m.group_id=$1 AND m.active AND EXISTS(SELECT 1 FROM questions q WHERE q.round_id=$2 AND q.locks_at>$3 AND q.state='open' AND (q.subject_id IS NULL OR q.subject_id<>m.user_id) AND NOT EXISTS(SELECT 1 FROM predictions p WHERE p.question_id=q.id AND p.user_id=m.user_id))`,[g,r.id,now])).rows;
 for(const m of members)await emitNotification(tx,{groupId:g,userId:m.user_id,key:'round:'+r.id+':lock',kind:'lock_reminder',roundId:r.id,text:t.practice?'First lock in a few minutes. You still have calls to pick.':'First lock in less than an hour. You still have calls to pick.',eventAt:new Date(lock.getTime()-t.lockReminderMs)},now);
 }
}
export async function notificationView(tx:Transaction,g:string,u:string,now:Date){
 const preferences=(await tx.query<NotificationPreferences>('SELECT muted,round_open,lock_reminder,weekly_final FROM notification_preferences WHERE group_id=$1 AND user_id=$2',[g,u])).rows[0]||defaultPreferences;
 const inbox=(await tx.query('SELECT id,kind,category,text,question_id,round_id,created_at,read_at,push_eligible,push_status FROM notifications WHERE group_id=$1 AND user_id=$2 AND in_app ORDER BY created_at DESC,id DESC LIMIT 100',[g,u])).rows;
 const count=(await tx.query<{routine_count:number}>('SELECT routine_count FROM notification_counters WHERE group_id=$1 AND user_id=$2 AND week_start=$3',[g,u,weekStartUTC(now)])).rows[0]?.routine_count||0;
 const suppressed=(await tx.query<{count:string}>('SELECT count(*) FROM notifications WHERE group_id=$1 AND user_id=$2 AND NOT in_app AND created_at >= $3::date',[g,u,weekStartUTC(now)])).rows[0].count;
 return{notificationPreferences:preferences,notifications:inbox,notificationUsage:{routineCount:count,cap:4,weekStart:weekStartUTC(now),suppressed:Number(suppressed),pushConnected:(await tx.query('SELECT 1 FROM devices WHERE user_id=$1 AND disabled_at IS NULL LIMIT 1',[u])).rows.length>0}};
}
