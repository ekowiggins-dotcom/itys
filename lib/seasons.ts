import {randomUUID} from 'node:crypto';import type {Transaction} from '@electric-sql/pglite';import {seasonTotals,seasonPhase,type SeasonRoundInput} from './season-rules';
type Season={id:string;group_id:string;name:string;starts_at:Date;ends_at:Date;frozen_at:Date|null;snapshot:SeasonProjection|null};
type Standing=ReturnType<typeof seasonTotals>&{user_id:string;name:string;active:boolean;rank:number};
export type SeasonProjection={id:string;name:string;starts_at:string;ends_at:string;state:string;frozen_at:string|null;pendingRounds:number;completedRounds:number;standings:Standing[]};
async function project(tx:Transaction,s:Season,now:Date):Promise<SeasonProjection>{
 const members=(await tx.query<{user_id:string;name:string;active:boolean}>('SELECT sm.user_id,u.name,m.active FROM season_members sm JOIN users u ON u.id=sm.user_id JOIN members m ON m.group_id=$2 AND m.user_id=sm.user_id WHERE sm.season_id=$1',[s.id,s.group_id])).rows;
 const rounds=(await tx.query<{id:string;opens_at:Date;state:string}>('SELECT id,opens_at,state FROM rounds WHERE group_id=$1 AND opens_at>=$2 AND opens_at<$3 ORDER BY opens_at',[s.group_id,s.starts_at,s.ends_at])).rows;
 const values=(await tx.query<{user_id:string;round_id:string;eligible:boolean;raw:string;picks:string}>(`SELECT sm.user_id,r.id round_id,(rm.user_id IS NOT NULL) eligible,COALESCE(sum(sc.points_value),0)::text raw,count(p.question_id) picks FROM rounds r JOIN season_members sm ON sm.season_id=$1 LEFT JOIN round_members rm ON rm.round_id=r.id AND rm.user_id=sm.user_id LEFT JOIN questions q ON q.round_id=r.id AND NOT q.superseded LEFT JOIN scores sc ON sc.question_id=q.id AND sc.user_id=sm.user_id LEFT JOIN predictions p ON p.question_id=q.id AND p.user_id=sm.user_id WHERE r.group_id=$2 AND r.opens_at>=$3 AND r.opens_at<$4 GROUP BY sm.user_id,r.id,rm.user_id`,[s.id,s.group_id,s.starts_at,s.ends_at])).rows;
 const longScores=(await tx.query<{user_id:string;raw:string}>("SELECT user_id,points_value::text raw FROM scores WHERE season_id=$1 AND allocation='credited'",[s.id])).rows;
 const standings:Standing[]=members.map(m=>{
 const entries:SeasonRoundInput[]=rounds.map(r=>{const v=values.find(v=>v.user_id===m.user_id&&v.round_id===r.id);return{id:r.id,opens_at:new Date(r.opens_at).toISOString(),state:r.state,eligible:!!v?.eligible,missed:!!v?.eligible&&Number(v.picks)===0,raw_score:v?.raw||'0'}});
 return {...seasonTotals(entries,longScores.filter(r=>r.user_id===m.user_id).map(r=>r.raw)),user_id:m.user_id,name:m.name,active:m.active,rank:0};
 });
 standings.sort((a,b)=>b.totalTenths-a.totalTenths||a.name.localeCompare(b.name)||a.user_id.localeCompare(b.user_id));let rank=1;standings.forEach((row,i)=>{if(i&&row.totalTenths!==standings[i-1].totalTenths)rank=i+1;row.rank=rank});
 return{id:s.id,name:s.name,starts_at:new Date(s.starts_at).toISOString(),ends_at:new Date(s.ends_at).toISOString(),state:seasonPhase(s,now),frozen_at:s.frozen_at?new Date(s.frozen_at).toISOString():null,pendingRounds:rounds.filter(r=>!['final','skipped'].includes(r.state)).length,completedRounds:rounds.filter(r=>r.state==='final').length,standings};
}
export async function maintainSeasons(tx:Transaction,g:string,now:Date){
 // Credit eligible held points before a season can freeze; start timestamps decide even after downtime.
 await tx.query(`UPDATE scores s SET allocation='credited',season_id=(SELECT se.id FROM seasons se JOIN questions q ON q.group_id=se.group_id WHERE q.id=s.question_id AND se.frozen_at IS NULL AND se.starts_at>=s.settled_at AND se.starts_at<=s.expires_at AND se.starts_at<=$2 ORDER BY se.starts_at LIMIT 1) WHERE s.allocation='pending' AND s.question_id IN (SELECT id FROM questions WHERE group_id=$1) AND EXISTS(SELECT 1 FROM seasons se JOIN questions q ON q.group_id=se.group_id WHERE q.id=s.question_id AND se.frozen_at IS NULL AND se.starts_at>=s.settled_at AND se.starts_at<=s.expires_at AND se.starts_at<=$2)`,[g,now]);
 await tx.query("UPDATE scores SET allocation='expired' WHERE allocation='pending' AND expires_at<$2 AND question_id IN(SELECT id FROM questions WHERE group_id=$1)",[g,now]);
 const seasons=(await tx.query<Season>('SELECT * FROM seasons WHERE group_id=$1 AND frozen_at IS NULL ORDER BY starts_at',[g])).rows;
 for(const s of seasons){
 await tx.query('INSERT INTO season_members SELECT $1,p.user_id,GREATEST(min(p.joined_at),$3::timestamptz) FROM membership_periods p WHERE p.group_id=$2 AND p.joined_at<$4 AND p.joined_at<=$5 AND (p.left_at IS NULL OR p.left_at>$3) GROUP BY p.user_id ON CONFLICT DO NOTHING',[s.id,g,s.starts_at,s.ends_at,now]);
 await tx.query('INSERT INTO season_members SELECT $1,user_id,min(settled_at) FROM scores WHERE season_id=$1 GROUP BY user_id ON CONFLICT DO NOTHING',[s.id]);
 const projection=await project(tx,s,now);
 for(const row of projection.standings){if(!row.dropCount)continue;
 const dropped=row.rounds.filter(r=>r.dropped);const text=`Your ${row.dropCount===1?'lowest completed round is':'two lowest completed rounds are'} now dropped: `+dropped.map(r=>new Date(r.opens_at).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short'})+' ('+(r.points_tenths/10).toFixed(1)+' pts)').join(', ')+'.';
 await tx.query('INSERT INTO season_drop_notices(id,season_id,user_id,drop_count,text,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(season_id,user_id,drop_count) DO NOTHING',[randomUUID(),s.id,row.user_id,row.dropCount,text,now]);}
 if(now>=new Date(s.ends_at)&&projection.pendingRounds===0){projection.state='frozen';projection.frozen_at=now.toISOString();await tx.query('UPDATE seasons SET frozen_at=$2,snapshot=$3 WHERE id=$1',[s.id,now,JSON.stringify(projection)]);}
 }
}
export async function seasonViews(tx:Transaction,g:string,userId:string,now:Date){
 const seasons=(await tx.query<Season>('SELECT * FROM seasons WHERE group_id=$1 ORDER BY starts_at DESC',[g])).rows;const views=[];
 for(const s of seasons){const all=s.frozen_at&&s.snapshot?s.snapshot:await project(tx,s,now);const notices=(await tx.query<{id:string;text:string;seen_at:Date|null}>('SELECT id,text,seen_at FROM season_drop_notices WHERE season_id=$1 AND user_id=$2 AND seen_at IS NULL ORDER BY created_at',[s.id,userId])).rows;
 const standings=all.state==='frozen'?all.standings:all.standings.filter(row=>row.active).map((row,i,visible)=>({...row,rank:i&&row.totalTenths===visible[i-1].totalTenths?visible.findIndex(v=>v.totalTenths===row.totalTenths)+1:i+1}));
 views.push({...all,standings,myStanding:standings.find(row=>row.user_id===userId)||all.standings.find(row=>row.user_id===userId),dropNotices:notices});}
 return views;
}
