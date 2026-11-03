import {touchMember,moderationView} from './moderation';
import {footballAction} from './football/actions';
import {nextStart,period,validAnswer,slotLimits,type GroupType} from './football/rules';
import {randomBytes,randomUUID} from 'node:crypto';
import {db} from './db';
import {seasonViews} from './seasons';
import {notificationView} from './notifications';
import {z} from 'zod';
import {lifecycle,maintain} from './lifecycle';
import {nextMonday,weeklyViews,type Round,DAY} from './rounds';
const name=z.string().trim().min(1).max(60);
export class RuleError extends Error{}
function check(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
export async function identity(token:string|undefined){if(!token)return;return(await(await db()).query<{id:string;name:string}>('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=$1',[token])).rows[0]}
export async function reconcile(invite:string,now=new Date()){
 const d=await db();await d.transaction(async tx=>{const g=(await tx.query<{id:string;opens_at:Date|null}>('SELECT id,opens_at FROM groups WHERE invite=$1 FOR UPDATE',[invite])).rows[0];if(g)await maintain(tx,g,now)});
}
export async function execute(input:unknown,token?:string,now=new Date()):Promise<{invite?:string;session?:string;questionId?:string}>{
 const action=(input as {action?:string})?.action;
 if(action?.startsWith('football')){const user=await identity(token);check(user,'Join the group first.');return footballAction(input,user.id,now)}
 if(action&&!['create','join','question','predict'].includes(action)){const user=await identity(token);check(user,'Join the group first.');return lifecycle(input,user.id,now)}
 const data=z.object({action:z.enum(['create','join','question','predict']),groupType:z.enum(['Friends','Football','Mixed']).optional(),timezone:z.string().optional(),country:z.string().optional(),requestId:z.uuid().optional(),name:name.optional(),groupName:name.optional(),invite:z.string().max(100).optional(),text:z.string().trim().min(3).max(240).optional(),locksAt:z.iso.datetime().optional(),questionId:z.uuid().optional(),subjectId:z.uuid().optional(),answer:z.string().max(5).optional(),stake:z.number().int().min(5).max(30).multipleOf(5).optional()}).parse(input);
 const d=await db(),existing=await identity(token);
 if(data.invite){if(existing)await d.query('UPDATE members SET last_active_at=GREATEST(last_active_at,$3) WHERE user_id=$1 AND group_id IN(SELECT id FROM groups WHERE invite=$2) AND active',[existing.id,data.invite,now]);await reconcile(data.invite,now);}
 return d.transaction(async tx=>{
 let user=existing,session:string|undefined;
 if(!user){check(data.action==='create'||data.action==='join','Join the group first.');user={id:randomUUID(),name:name.parse(data.name)};session=randomBytes(32).toString('hex');await tx.query('INSERT INTO users VALUES($1,$2)',[user.id,user.name]);await tx.query('INSERT INTO sessions VALUES($1,$2)',[session,user.id]);}
 if(data.action==='create'){
 const id=randomUUID(),invite=randomBytes(18).toString('hex'),type=data.groupType||'Friends',zone=data.timezone||(type==='Friends'?'UTC':'Europe/Istanbul');try{new Intl.DateTimeFormat('en',{timeZone:zone}).format(now)}catch{throw new RuleError('Choose a valid time zone.')}await tx.query('INSERT INTO groups(id,name,invite,admin,group_type,timezone,country,leagues) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,name.parse(data.groupName),invite,user.id,type,zone,data.country||'TR',JSON.stringify([203])]);await tx.query('INSERT INTO members(group_id,user_id,joined_at,last_active_at) VALUES($1,$2,$3,$3)',[id,user.id,now]);await tx.query('INSERT INTO membership_periods VALUES($1,$2,$3,$4,NULL)',[randomUUID(),id,user.id,now]);await tx.query('INSERT INTO round_eligibility VALUES($1,$2) ON CONFLICT DO NOTHING',[id,user.id]);return {invite,session};
 }
 const g=(await tx.query<{id:string;opens_at:Date|null;group_type:GroupType;timezone:string}>('SELECT * FROM groups WHERE invite=$1 FOR UPDATE',[data.invite])).rows[0];check(g,'This invite link was not found.');
 const member=(await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,user.id])).rows.length>0;
 if(data.action==='join'){
 if(!member){const count=Number((await tx.query<{count:string}>('SELECT count(*) FROM members WHERE group_id=$1 AND active',[g.id])).rows[0].count);check(count<30,'This group is full.');await tx.query('INSERT INTO members(group_id,user_id,joined_at,last_active_at) VALUES($1,$2,$3,$3) ON CONFLICT(group_id,user_id) DO UPDATE SET active=true,last_active_at=EXCLUDED.last_active_at',[g.id,user.id,now]);await tx.query('INSERT INTO membership_periods VALUES($1,$2,$3,$4,NULL)',[randomUUID(),g.id,user.id,now]);
 if(count===2&&!g.opens_at){const start=nextStart(now,g.group_type,g.timezone);await tx.query('UPDATE groups SET opens_at=$1,next_round_at=$1 WHERE id=$2',[start,g.id]);if(!(await tx.query('SELECT id FROM seasons WHERE group_id=$1',[g.id])).rows.length)await tx.query('INSERT INTO seasons(id,group_id,name,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),g.id,'Pilot season · 8 weeks',start,new Date(start.getTime()+56*DAY)]);g.opens_at=start;}
 }
 await tx.query('INSERT INTO round_eligibility VALUES($1,$2) ON CONFLICT DO NOTHING',[g.id,user.id]);
 await tx.query('INSERT INTO round_members SELECT id,$2 FROM rounds WHERE group_id=$1 AND opens_at<=$3 AND pick_end_at>=$3 AND state IN (\'live\',\'provisional\',\'waiting_feed\') ON CONFLICT DO NOTHING',[g.id,user.id,now]);
 await maintain(tx,g,now);return {invite:data.invite,session};
 }
 check(member,'Join this group first.');
 const round=(await tx.query<Round>("SELECT r.* FROM rounds r WHERE r.group_id=$1 AND r.state IN ('live','provisional') AND r.content_ready AND r.opens_at<=$2 AND r.pick_end_at>=$2 AND ($3::text IS NULL OR r.id=(SELECT round_id FROM questions WHERE id=$3)) ORDER BY r.opens_at DESC LIMIT 1",[g.id,now,data.action==='predict'?data.questionId||null:null])).rows[0];
 if(data.action==='question'){
 if(data.requestId){const old=(await tx.query<{question_id:string}>('SELECT question_id FROM question_requests WHERE group_id=$1 AND user_id=$2 AND request_id=$3',[g.id,user.id,data.requestId])).rows[0];if(old)return {invite:data.invite,questionId:old.question_id};}
 check(g.opens_at,'Invite at least three members before adding a bet.');check(round,'Wait for the next weekly round to open.');check(slotLimits(round.group_type).custom>0,'Football groups use match picks only.');check(now<=period(new Date(round.opens_at),round.group_type,round.timezone).customCutoff,'Custom-bet creation has closed for this round.');
 const lock=new Date(z.iso.datetime().parse(data.locksAt));check(lock>now&&lock<=new Date(round.deadline_at),'Choose a future lock time no later than Sunday 23:59 in '+round.timezone+'.');
 const count=Number((await tx.query<{count:string}>("SELECT count(*) FROM questions WHERE round_id=$1 AND slot='custom' AND NOT superseded",[round.id])).rows[0].count);check(count<slotLimits(round.group_type).custom,round.group_type==='Friends'?'All six bet slots are used.':'All three custom-bet slots are used.');
 if(data.subjectId)check((await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,data.subjectId])).rows.length,'The tagged subject must be a member.');
 const id=randomUUID();await tx.query('INSERT INTO questions(id,group_id,creator,text,locks_at,round_id,event_at,subject_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,g.id,user.id,z.string().trim().min(3).max(240).parse(data.text),lock,round.id,round.deadline_at,data.subjectId||null]);
 if(data.requestId)await tx.query('INSERT INTO question_requests VALUES($1,$2,$3,$4)',[g.id,user.id,data.requestId,id]);return {invite:data.invite,questionId:id};
 }
 check(round,'Competition starts next Monday after three members join, during an active season.');
 const q=(await tx.query<{locks_at:Date;subject_id:string|null;market:string;fixture_id:string|null}>("SELECT locks_at,subject_id,market,fixture_id FROM questions WHERE id=$1 AND group_id=$2 AND round_id=$3 AND NOT superseded AND state='open' AND moderation_state='visible'",[data.questionId,g.id,round.id])).rows[0];check(q&&now<new Date(q.locks_at),'This bet is locked or unavailable.');check(q.subject_id!==user.id,'The tagged subject cannot predict on this bet.');check(validAnswer(q.market,data.answer||''),'Choose a valid answer for this market.');if(q.fixture_id){const f=(await tx.query<{status:string;kickoff:Date}>('SELECT status,kickoff FROM football_fixtures WHERE id=$1',[q.fixture_id])).rows[0];check(f?.status==='scheduled'&&now<new Date(f.kickoff),'This match has started or is unavailable.');}
 const stake=z.number().int().min(5).max(30).multipleOf(5).parse(data.stake),answer=z.string().parse(data.answer);
 const used=Number((await tx.query<{total:string}>('SELECT COALESCE(sum(p.stake),0) total FROM predictions p JOIN questions q ON q.id=p.question_id WHERE q.round_id=$1 AND p.user_id=$2 AND NOT q.superseded AND p.question_id<>$3',[round.id,user.id,data.questionId])).rows[0].total);check(used+stake<=100,'You do not have enough confidence points left.');
 await tx.query('INSERT INTO predictions(question_id,user_id,answer,stake,submitted_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(question_id,user_id) DO UPDATE SET answer=EXCLUDED.answer,stake=EXCLUDED.stake,submitted_at=EXCLUDED.submitted_at',[data.questionId,user.id,answer,stake,now]);await tx.query('INSERT INTO round_members VALUES($1,$2) ON CONFLICT DO NOTHING',[round.id,user.id]);return {invite:data.invite};
 });
}
export async function view(invite:string,token?:string,selectedRound?:string,now=new Date()){
 const d=await db(),user=await identity(token);if(user)await d.query('UPDATE members SET last_active_at=GREATEST(last_active_at,$3) WHERE user_id=$1 AND group_id IN(SELECT id FROM groups WHERE invite=$2) AND active',[user.id,invite,now]);await reconcile(invite,now);
 return d.transaction(async tx=>{
 const group=(await tx.query<{id:string;name:string;opens_at:Date|null;next_round_at:Date|null;fallback_id:string|null;group_type:GroupType;timezone:string;leagues:number[];pending_settings:unknown}>('SELECT id,name,opens_at,next_round_at,fallback_id,group_type,timezone,leagues,country,pending_settings FROM groups WHERE invite=$1',[invite])).rows[0];check(group,'This invite link was not found.');
 const members=Number((await tx.query<{count:string}>('SELECT count(*) FROM members WHERE group_id=$1 AND active',[group.id])).rows[0].count);
 const joined=!!user&&(await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[group.id,user.id])).rows.length>0;
 if(!joined)return {moderation:undefined,group:{name:group.name},members,joined:false,user,questions:[],used:0,rounds:[],selectedRound:undefined,currentRoundId:undefined,roundScores:[],snapshots:[],audit:[],bets:[],alerts:[],seasons:[],seasonStandings:[],groupMembers:[],suggestions:[],fixtureCatalog:[],leagueCatalog:[],feedStatus:undefined,longTermCount:0,notifications:[],notificationPreferences:undefined,notificationUsage:undefined};
 const rounds=await weeklyViews(tx,group.id);
 const current=rounds.find(r=>['live','provisional','waiting_feed'].includes(r.state)&&new Date(r.pick_end_at)>=now)||rounds[0];
 const selected=rounds.find(r=>r.id===selectedRound)||current;
 const questions=(await tx.query<{id:string;text:string;locks_at:Date;answer:string|null;stake:number|null;picked:number}>(`SELECT q.id,q.text,q.moderation_state,q.locks_at,q.market,q.slot,q.fixture_id,q.result_answer,q.state,q.selection_reason,q.void_reason,f.home,f.away,f.status fixture_status,f.home90,f.away90,f.league_name,f.kickoff,p.answer,p.stake,(SELECT count(*)::integer FROM predictions allp WHERE allp.question_id=q.id) picked FROM questions q LEFT JOIN football_fixtures f ON f.id=q.fixture_id LEFT JOIN predictions p ON p.question_id=q.id AND p.user_id=$2 WHERE q.round_id=$1 AND NOT q.superseded ORDER BY q.slot,q.locks_at,q.market`,[selected?.id||null,user!.id])).rows;
 const bets=(await tx.query(`SELECT q.*,(SELECT count(*)::int FROM predictions ap WHERE ap.question_id=q.id) picked,CASE WHEN b.blocked_id IS NOT NULL THEN 'a group member' ELSE u.name END creator_name,p.answer,p.stake,p.forfeited,s.points_tenths,s.allocation,s.expires_at,s.season_id score_season_id,(SELECT count(*)::int FROM disputes di WHERE di.question_id=q.id) disputes FROM questions q JOIN users u ON u.id=q.creator LEFT JOIN blocks b ON b.group_id=q.group_id AND b.user_id=$2 AND b.blocked_id=q.creator LEFT JOIN predictions p ON p.question_id=q.id AND p.user_id=$2 LEFT JOIN scores s ON s.question_id=q.id AND s.user_id=$2 WHERE q.group_id=$1 AND NOT q.superseded AND (q.scope='longterm' OR q.round_id=$3) ORDER BY q.locks_at`,[group.id,user!.id,selected?.id||null])).rows;
 const alerts=(await tx.query<{id:string;question_id:string|null;stage:string;essential:boolean;created_at:Date;text:string}>(`SELECT a.id,a.question_id,a.stage,a.essential,a.created_at,q.text FROM alerts a JOIN questions q ON q.id=a.question_id WHERE a.group_id=$1 AND a.user_id=$2 UNION ALL SELECT re.round_id||re.kind id,NULL question_id,re.kind stage,false essential,re.created_at,re.text FROM round_events re JOIN rounds r ON r.id=re.round_id WHERE r.group_id=$1 AND re.user_id=$2 ORDER BY created_at DESC LIMIT 60`,[group.id,user!.id])).rows;
 const seasons=await seasonViews(tx,group.id,user!.id,now);
 const groupMembers=(await tx.query<{user_id:string;name:string;active:boolean;joined_at:Date;admin:boolean;fallback:boolean}>('SELECT m.user_id,u.name,m.active,m.joined_at,(g.admin=m.user_id) admin,(g.fallback_id=m.user_id) fallback FROM members m JOIN users u ON u.id=m.user_id JOIN groups g ON g.id=m.group_id WHERE m.group_id=$1 ORDER BY m.joined_at,m.user_id',[group.id])).rows;
 const audit=(await tx.query(`SELECT a.*,COALESCE(u.name,'System') actor_name,q.text FROM audit a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN questions q ON q.id=a.question_id WHERE a.group_id=$1 ORDER BY a.created_at DESC LIMIT 100`,[group.id])).rows;
 const snapshots=(await tx.query(`SELECT lp.question_id,lp.user_id,u.name,lp.answer,lp.stake,ls.total,ls.locked_at FROM locked_predictions lp JOIN lock_snapshots ls ON ls.question_id=lp.question_id JOIN users u ON u.id=lp.user_id JOIN questions q ON q.id=lp.question_id WHERE q.group_id=$1 AND (q.round_id=$2 OR q.scope='longterm')`,[group.id,selected?.id||null])).rows;
 const seasonStandings=seasons.flatMap(s=>s.standings.map(row=>({season_id:s.id,user_id:row.user_id,name:row.name,active:row.active,points_tenths:row.totalTenths})));
 const notificationData=await notificationView(tx,group.id,user!.id,now);
 const longTermCount=Number((await tx.query<{count:string}>("SELECT count(*) FROM predictions p JOIN questions q ON q.id=p.question_id WHERE q.group_id=$1 AND p.user_id=$2 AND q.scope='longterm' AND q.state NOT IN ('settled','void') AND NOT p.forfeited",[group.id,user!.id])).rows[0].count);
 const fixtureCatalog=(await tx.query('SELECT * FROM football_fixtures WHERE kickoff>$1 AND kickoff<$2 ORDER BY kickoff LIMIT 200',[now,selected?.fixture_end_at||new Date(now.getTime()+7*DAY)])).rows;
 const leagueCatalog=(await tx.query('SELECT * FROM football_leagues ORDER BY country,name')).rows;
 const feedStatus={...((await tx.query<{last_attempt:Date|null;last_success:Date|null;error:string|null}>("SELECT last_attempt,last_success,error FROM football_feed_status WHERE id='api-football'")).rows[0]||{error:'Live feed not connected'}),connected:!!process.env.API_FOOTBALL_KEY};
 const moderation=await moderationView(tx,group.id,user!.id,now);
 // Hidden content is redacted in every member-facing surface, including historical notifications and audit.
 const hidden=(await tx.query<{id:string;moderation_state:string}>("SELECT id,moderation_state FROM questions WHERE group_id=$1 AND moderation_state<>'visible'",[group.id])).rows;const hiddenIds=new Set(hidden.map(q=>q.id));
 for(const row of [...questions,...bets] as Record<string,unknown>[])if(hiddenIds.has(String(row.id))){row.text='Bet hidden by moderation';row.creator_name='a group member';row.moderation_state=hidden.find(q=>q.id===row.id)!.moderation_state;}
 for(const row of [...alerts,...audit,...notificationData.notifications] as Record<string,unknown>[])if(hiddenIds.has(String(row.question_id))){row.text='Bet hidden by moderation';if(row.details)row.details=null;}
 const suggestions=alerts.filter(a=>a.stage==='suggestion');
 return {group:{...group,opens_at:selected?.opens_at||group.opens_at},members,joined,user,questions,used:questions.reduce((sum,q)=>sum+Number(q.stake||0),0),bets,alerts,seasons,groupMembers,moderation,audit,snapshots,...notificationData,rounds,selectedRound:selected,currentRoundId:current?.id,roundScores:selected?.standings||[],seasonStandings,suggestions,longTermCount,fixtureCatalog,leagueCatalog,feedStatus};
 });
}
