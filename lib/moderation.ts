import {randomUUID} from 'node:crypto';
import type {Transaction} from '@electric-sql/pglite';
import {emitNotification} from './notifications';
const DAY=86400000;
export const moderationActions=['report','unblock','subjectRemoval','reviewRemoval','removeBet','appealRemoval','recoverAdmin','respondRecovery'];
type Group={id:string;admin:string};
type Input={action:string;questionId?:string;targetId?:string;reason?:string;decision?:string};
async function record(tx:Transaction,g:string,u:string|null,action:string,now:Date,q:string|null=null,details:unknown=null){await tx.query('INSERT INTO audit(id,group_id,question_id,actor_id,action,created_at,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),g,q,u,action,now,JSON.stringify(details)])}
async function notify(tx:Transaction,g:string,key:string,text:string,now:Date,only?:string){const members=(await tx.query<{user_id:string}>('SELECT user_id FROM members WHERE group_id=$1 AND active AND ($2::text IS NULL OR user_id=$2)',[g,only||null])).rows;for(const m of members)await emitNotification(tx,{groupId:g,userId:m.user_id,key,kind:'moderation',text},now)}
export async function touchMember(tx:Transaction,g:string,u:string,now:Date){await tx.query('UPDATE members SET last_active_at=GREATEST(last_active_at,$3) WHERE group_id=$1 AND user_id=$2 AND active',[g,u,now]);}
export async function maintainRecovery(tx:Transaction,g:string,now:Date){
 const r=(await tx.query<{id:string;admin_id:string;requested_at:Date;deadline_at:Date}>('SELECT * FROM admin_recoveries WHERE group_id=$1 AND status=\'pending\' FOR UPDATE',[g])).rows[0];if(!r)return;
 const current=(await tx.query<{admin:string;last_active_at:Date}>('SELECT g.admin,m.last_active_at FROM groups g JOIN members m ON m.group_id=g.id AND m.user_id=g.admin WHERE g.id=$1',[g])).rows[0];
 if(current.admin!==r.admin_id||(new Date(current.last_active_at)>=new Date(r.requested_at)&&new Date(current.last_active_at)<=new Date(r.deadline_at))){await tx.query("UPDATE admin_recoveries SET status='cancelled',resolved_at=$2 WHERE id=$1",[r.id,now]);await record(tx,g,r.admin_id,'admin recovery cancelled',now);await notify(tx,g,'recovery:'+r.id+':cancelled','Admin recovery cancelled: the admin responded or the role changed.',now);return;}
 if(now<new Date(r.deadline_at))return;
 const winner=(await tx.query<{user_id:string}>(`SELECT m.user_id FROM admin_recovery_requests req JOIN members m ON m.user_id=req.user_id AND m.group_id=$2 WHERE req.recovery_id=$1 AND m.active ORDER BY m.joined_at,m.user_id LIMIT 1`,[r.id,g])).rows[0];
 await tx.query("UPDATE admin_recoveries SET status=$2,resolved_at=$3,new_admin_id=$4 WHERE id=$1",[r.id,winner?'completed':'expired',now,winner?.user_id||null]);
 if(winner)await tx.query('UPDATE groups SET admin=$2 WHERE id=$1',[g,winner.user_id]);
 await record(tx,g,winner?.user_id||null,winner?'admin recovered':'admin recovery expired',now,null,{targetId:winner?.user_id});await notify(tx,g,'recovery:'+r.id+':completed',winner?'The admin role passed to the longest-standing current member who requested it.':'Admin recovery expired: no requesting member remains in the group.',now);
}
export async function moderationAction(tx:Transaction,g:Group,u:string,p:Input,now:Date,voidBet:(id:string)=>Promise<void>){
 const require=(ok:unknown,text:string)=>{if(!ok)throw new Error(text)};
 if(p.action==='unblock'){await tx.query('DELETE FROM blocks WHERE group_id=$1 AND user_id=$2 AND blocked_id=$3',[g.id,u,p.targetId]);return;}
 if(p.action==='respondRecovery'){require(g.admin===u,'Only the admin can respond.');await touchMember(tx,g.id,u,now);await maintainRecovery(tx,g.id,now);return;}
 if(p.action==='recoverAdmin'){
 require(g.admin!==u,'You already administer this group.');const admin=(await tx.query<{last_active_at:Date}>('SELECT last_active_at FROM members WHERE group_id=$1 AND user_id=$2',[g.id,g.admin])).rows[0];require(now.getTime()-new Date(admin.last_active_at).getTime()>=14*DAY,'Recovery is available after 14 days of admin inactivity.');
 let r=(await tx.query<{id:string}>("SELECT id FROM admin_recoveries WHERE group_id=$1 AND status='pending'",[g.id])).rows[0];if(!r){r={id:randomUUID()};await tx.query('INSERT INTO admin_recoveries(id,group_id,admin_id,requested_at,deadline_at) VALUES($1,$2,$3,$4,$5)',[r.id,g.id,g.admin,now,new Date(now.getTime()+2*DAY)]);await notify(tx,g.id,'recovery:'+r.id,'Admin recovery requested. The admin has 48 hours to respond.',now);}
 await tx.query('INSERT INTO admin_recovery_requests VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[r.id,u,now]);await record(tx,g.id,u,'admin recovery requested',now);return;
 }
 const q=(await tx.query<{id:string;market:string;moderation_state:string;subject_id:string|null;state:string;round_id:string|null}>('SELECT * FROM questions WHERE id=$1 AND group_id=$2 AND NOT superseded FOR UPDATE',[p.questionId,g.id])).rows[0];require(q,'Bet not found.');
 const reason=p.reason?.trim();
 if(['report','subjectRemoval','appealRemoval','removeBet'].includes(p.action))require(reason&&reason.length>=3&&reason.length<=1000,'Give a reason of 3–1000 characters.');
 if(p.action==='report'){await tx.query('INSERT INTO moderation_reports(id,group_id,question_id,reporter_id,reason,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(question_id,reporter_id) DO NOTHING',[randomUUID(),g.id,q.id,u,reason,now]);return;}
 if(p.action==='appealRemoval'){require(q.moderation_state==='removed','Only an admin removal can be appealed.');require(!(await tx.query('SELECT 1 FROM removal_appeals WHERE question_id=$1 AND user_id=$2',[q.id,u])).rows.length,'You have already appealed this removal.');await tx.query('INSERT INTO removal_appeals(id,group_id,question_id,user_id,reason,created_at) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),g.id,q.id,u,reason,now]);return;}
 require(q.market==='custom','Football questions cannot be removed by group moderation.');
 if(p.action==='subjectRemoval'){require(q.subject_id===u,'Only the tagged subject can request removal.');require(q.moderation_state==='visible','This bet already has a removal request.');require(!(await tx.query('SELECT 1 FROM subject_removals WHERE question_id=$1',[q.id])).rows.length,'This bet has already been reviewed. Use reporting for further concerns.');await tx.query('INSERT INTO subject_removals(id,group_id,question_id,subject_id,reason,created_at) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),g.id,q.id,u,reason,now]);await tx.query("UPDATE questions SET moderation_state='pending' WHERE id=$1",[q.id]);await notify(tx,g.id,'removal:'+q.id,'A tagged subject requested bet removal. Review it in Safety & admin.',now,g.admin);}
 else{require(g.admin===u,'Only the admin can review or remove bets.');
 if(p.action==='reviewRemoval'){require(q.moderation_state==='pending','There is no pending removal request.');require(['restore','remove'].includes(p.decision||''),'Choose restore or remove.');await tx.query('UPDATE subject_removals SET status=$2,reviewed_by=$3,reviewed_at=$4 WHERE question_id=$1',[q.id,p.decision==='restore'?'restored':'removed',u,now]);}
 const remove=p.action==='removeBet'||p.decision==='remove';require(remove||p.action==='reviewRemoval','Unknown moderation action.');
 if(remove){require(q.moderation_state!=='removed','This bet was already removed.');require(q.state!=='settled','Final results cannot be rewritten by moderation. Report the bet for team review.');if(q.state!=='void')await voidBet(q.id);}
 await tx.query('UPDATE questions SET moderation_state=$2 WHERE id=$1',[q.id,remove?'removed':'visible']);await notify(tx,g.id,'moderation:'+q.id+':'+(remove?'removed':'restored'),remove?'A custom bet was removed. Its predictions are void (stake × 1).':'A subject removal request was reviewed and the bet restored.',now);
 }
 await record(tx,g.id,u,p.action,now,q.id,{decision:p.decision||null,reason:reason||null});
}
export async function moderationView(tx:Transaction,g:string,u:string,now:Date){
 const admin=(await tx.query<{admin:string;last_active_at:Date}>('SELECT g.admin,m.last_active_at FROM groups g JOIN members m ON m.group_id=g.id AND m.user_id=g.admin WHERE g.id=$1',[g])).rows[0];
 return{blockedIds:(await tx.query<{blocked_id:string}>('SELECT blocked_id FROM blocks WHERE group_id=$1 AND user_id=$2',[g,u])).rows.map(x=>x.blocked_id),reports:(await tx.query('SELECT id,question_id,reason,status,created_at FROM moderation_reports WHERE group_id=$1 AND reporter_id=$2 ORDER BY created_at DESC',[g,u])).rows,appeals:(await tx.query('SELECT id,question_id,reason,status,created_at FROM removal_appeals WHERE group_id=$1 AND user_id=$2 ORDER BY created_at DESC',[g,u])).rows,removalRequests:(await tx.query('SELECT * FROM subject_removals WHERE group_id=$1 AND ($2=$3 OR subject_id=$2) ORDER BY created_at DESC',[g,u,admin.admin])).rows,recovery:(await tx.query<{id:string;status:string;deadline_at:Date;request_count:number;requested_by_me:boolean}>('SELECT r.*,(SELECT count(*)::int FROM admin_recovery_requests req WHERE req.recovery_id=r.id) request_count,EXISTS(SELECT 1 FROM admin_recovery_requests req WHERE req.recovery_id=r.id AND req.user_id=$2) requested_by_me FROM admin_recoveries r WHERE group_id=$1 ORDER BY requested_at DESC LIMIT 1',[g,u])).rows[0]||null,adminLastActive:admin.last_active_at,recoveryEligible:admin.admin!==u&&now.getTime()-new Date(admin.last_active_at).getTime()>=14*DAY};
}
