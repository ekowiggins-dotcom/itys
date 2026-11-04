import {touchMember} from '../moderation';import {z} from 'zod';import {randomUUID} from 'node:crypto';import {db} from '../db';import {maintain,LifecycleError} from '../lifecycle';import {addMarkets} from './content';import {nextStart,slotLimits,type Fixture,type GroupType} from './rules';import type {Round} from '../rounds';import {emitNotification} from '../notifications';import {ApiFootball} from './provider';import {syncLeague} from './store';
function check(ok:unknown,message:string):asserts ok{if(!ok)throw new LifecycleError(message)}
const schema=z.object({action:z.enum(['footballSettings','footballExtra','footballSwap','footballMotw','footballSearch']),invite:z.string(),roundId:z.uuid().optional(),fixtureId:z.string().max(100).optional(),outgoingId:z.string().max(100).optional(),groupType:z.enum(['Friends','Football','Mixed']).optional(),timezone:z.string().max(80).optional(),country:z.string().max(60).optional(),leagues:z.array(z.number().int().positive()).min(1).max(10).optional(),leagueId:z.number().int().positive().optional(),search:z.string().trim().min(3).max(60).optional()});
export async function footballAction(input:unknown,userId:string,now=new Date()){
 const data=schema.parse(input),d=await db();
 const g=(await d.query<{id:string;admin:string;opens_at:Date|null}>('SELECT id,admin,opens_at FROM groups WHERE invite=$1',[data.invite])).rows[0];check(g,'Group not found.');check((await d.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,userId])).rows.length,'Join this group first.');
 await d.transaction(tx=>touchMember(tx,g.id,userId,now));
 if(data.action==='footballSearch'){
 check(process.env.API_FOOTBALL_KEY,'The live football feed is not connected.');
 const claim=await d.query('INSERT INTO football_feed_status(id,next_poll) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET next_poll=$2 WHERE football_feed_status.next_poll<=$3 RETURNING id',['search:'+userId,new Date(now.getTime()+10000),now]);check(claim.rows.length,'Please wait a few seconds before searching again.');
 if(data.leagueId)await syncLeague(data.leagueId,now);else if(data.search){const api=new ApiFootball(process.env.API_FOOTBALL_KEY!);const leagues=await api.search(data.search);for(const l of leagues)await d.query('INSERT INTO football_leagues VALUES($1,$2,$3,0,$4) ON CONFLICT(id) DO NOTHING',[l.id,l.name,l.country,new Date(0)]);}
 return{invite:data.invite};
 }
 await d.transaction(async tx=>{await tx.query('SELECT id FROM groups WHERE id=$1 FOR UPDATE',[g.id]);await maintain(tx,g,now)});
 return d.transaction(async tx=>{
 Object.assign(g,(await tx.query('SELECT id,admin,opens_at,timezone,leagues,country FROM groups WHERE id=$1 FOR UPDATE',[g.id])).rows[0]);const current=g as unknown as {timezone:string;leagues:number[];country:string};check((await tx.query('SELECT 1 FROM members WHERE group_id=$1 AND user_id=$2 AND active',[g.id,userId])).rows.length,'Join this group first.');
 if(data.action==='footballSettings'){
 check(g.admin===userId,'Only the admin can change group settings.');const groupType=data.groupType||'Mixed',zone=data.timezone||current.timezone,leagues=data.leagues||current.leagues;try{new Intl.DateTimeFormat('en',{timeZone:zone}).format(now)}catch{throw new LifecycleError('Choose a valid time zone.')}
 const settings={groupType,timezone:zone,leagues,country:data.country||current.country};const next=nextStart(now,groupType,zone);
 await tx.query('DELETE FROM round_members WHERE round_id IN(SELECT id FROM rounds WHERE group_id=$1 AND state=\'planned\')',[g.id]);await tx.query("DELETE FROM rounds WHERE group_id=$1 AND state='planned'",[g.id]);
 const opened=(await tx.query("SELECT 1 FROM rounds WHERE group_id=$1 AND state<>'planned'",[g.id])).rows.length;
 if(!g.opens_at)await tx.query('UPDATE groups SET group_type=$2,timezone=$3,leagues=$4,country=$5 WHERE id=$1',[g.id,groupType,zone,JSON.stringify(leagues),settings.country]);
 else await tx.query('UPDATE groups SET pending_settings=$2,next_round_at=$3,opens_at=CASE WHEN $4 THEN opens_at ELSE $3 END WHERE id=$1',[g.id,JSON.stringify(settings),next,!!opened]);
 await tx.query('INSERT INTO audit(id,group_id,actor_id,action,created_at,details) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),g.id,userId,'future football settings',now,JSON.stringify(settings)]);return{invite:data.invite};
 }
 const r=(await tx.query<Round>('SELECT * FROM rounds WHERE id=$1 AND group_id=$2',[data.roundId,g.id])).rows[0];check(r&&r.group_type!=='Friends'&&r.content_ready&&!['final','skipped','planned'].includes(r.state)&&now<new Date(r.pick_end_at),'This football round is unavailable.');
 const f=(await tx.query<Fixture>('SELECT * FROM football_fixtures WHERE id=$1',[data.fixtureId])).rows[0];check(f,'Fixture not found.');f.kickoff=new Date(f.kickoff).toISOString();check(f.status==='scheduled'&&new Date(f.kickoff)>now&&new Date(f.kickoff)>=new Date(r.opens_at)&&new Date(f.kickoff)<new Date(r.fixture_end_at),'Choose a fixture that has not started and belongs to this round’s dates.');
 const active=(await tx.query<{id:string;fixture_id:string;market:string;slot:string;locks_at:Date}>('SELECT id,fixture_id,market,slot,locks_at FROM questions WHERE round_id=$1 AND NOT superseded',[r.id])).rows;
 if(data.action==='footballExtra'){
 check(!active.some(q=>q.fixture_id===f.id),'This match is already in the round.');check(active.filter(q=>q.slot==='extra').length<slotLimits(r.group_type).extra,'All extra-match slots are used.');check(active.length<slotLimits(r.group_type).total,'This round is full.');await addMarkets(tx,r,f,'extra',userId,['result'],'Added by a group member');
 }else{
 check(g.admin===userId,'Only the admin can swap featured matches or choose match of the week.');
 const outgoing=data.action==='footballMotw'?active.find(q=>q.slot==='motw')?.fixture_id:data.outgoingId;check(outgoing,'Outgoing featured match not found.');
 const oldFixture=(await tx.query<Fixture>('SELECT * FROM football_fixtures WHERE id=$1',[outgoing])).rows[0];check(oldFixture&&oldFixture.status==='scheduled'&&new Date(oldFixture.kickoff)>now,'The outgoing match has already started or is unavailable.');
 const removed=active.filter(q=>q.fixture_id===outgoing&&(data.action==='footballSwap'||q.slot==='motw'));check(removed.length&&removed.every(q=>new Date(q.locks_at)>now),'A question on the outgoing match has locked.');
 if(data.action==='footballMotw')check(active.some(q=>q.fixture_id===f.id&&q.slot==='featured')&&f.id!==outgoing,'Choose another unlocked featured match.');else{check(removed.some(q=>q.slot==='featured'),'Only featured matches can be swapped.');check(!active.some(q=>q.fixture_id===f.id),'This match is already in the round.');check(r.leagues.includes(f.league_id),'Featured replacements must come from the followed leagues.');}
 const refunds=new Map<string,number>();for(const q of removed){const picks=(await tx.query<{user_id:string;stake:number}>('SELECT user_id,stake FROM predictions WHERE question_id=$1',[q.id])).rows;for(const p of picks)refunds.set(p.user_id,(refunds.get(p.user_id)||0)+p.stake);await tx.query('DELETE FROM predictions WHERE question_id=$1',[q.id]);await tx.query("UPDATE questions SET superseded=true,state='void',void_reason='Replaced before lock' WHERE id=$1",[q.id]);}
 if(data.action==='footballSwap')await addMarkets(tx,r,f,'featured',userId,['result'],'Admin fixture swap');
 for(const [userId,points] of refunds)await emitNotification(tx,{groupId:g.id,userId,key:'swap:'+r.id+':'+outgoing+':'+f.id,kind:'match_change',roundId:r.id,text:'A match was swapped before kick-off. Your pick on it was cleared: make a call on the new one.'},now);
 }
 await tx.query('INSERT INTO audit(id,group_id,actor_id,action,created_at,details) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),g.id,userId,data.action,now,JSON.stringify({round:r.id,incoming:f.id,outgoing:data.outgoingId||null})]);return{invite:data.invite};
 });
}
