// Moments: a bundle of calls around one occasion. Same calls, same scoring; they just close together and end with one result.
import {randomUUID} from 'node:crypto';
import type {Transaction} from '@electric-sql/pglite';
import {z} from 'zod';
import {friendOptions} from './friends';
import {cleanOptions} from './football/rules';
import {newCode} from './short-links';

import {MOMENT_KINDS} from './moment-starters';
export {MOMENT_KINDS,starters,type MomentKind} from './moment-starters';

export const momentInput=z.object({kind:z.enum(MOMENT_KINDS),title:z.string().trim().min(2).max(60),subject:z.string().trim().max(60).optional(),startsAt:z.iso.datetime(),sealed:z.boolean().optional(),opensAt:z.iso.datetime().optional(),
 calls:z.array(z.object({text:z.string().trim().min(3).max(240),answerType:z.enum(['friend','choice']),options:z.array(z.string().max(60)).max(4).optional()})).min(1).max(8)});

/**
 * Create a Moment and its calls in one go. Every call closes when the Moment starts.
 * Within this week: weekly calls in the current round. Later: long-term calls (season points), not limited to three.
 * Moment calls never use the group's weekly call slots. Moves no points.
 */
export async function createMoment(tx:Transaction,g:{id:string;timezone:string;practice:boolean},userId:string,input:unknown,now:Date,fail:(m:string)=>never){
 const m=momentInput.parse(input),starts=new Date(m.startsAt);
 if(starts.getTime()<now.getTime()+10*60000)fail('Pick a start time at least 10 minutes from now.');
 if(starts.getTime()>now.getTime()+366*86400000)fail('Moments can be up to a year ahead.');
 // Sealed: picks close at the seal date; nothing is shown until the opening date, then the group opens them together.
 const opens=m.sealed?new Date(m.opensAt||''):null;
 if(m.sealed&&(!opens||isNaN(opens.getTime())||opens.getTime()<starts.getTime()+86400000))fail('Pick an opening date at least a day after the seal date.');
 if(opens&&opens.getTime()>now.getTime()+2*366*86400000)fail('Sealed predictions can open up to two years ahead.');
 const round=(await tx.query<{id:string;deadline_at:Date}>("SELECT id,deadline_at FROM rounds WHERE group_id=$1 AND state='live' AND opens_at<=$2 AND deadline_at>$2 ORDER BY opens_at DESC LIMIT 1",[g.id,now])).rows[0];
 const weekly=!opens&&!!round&&starts<=new Date(round.deadline_at);
 const id=randomUUID();
 await tx.query('INSERT INTO moments(id,group_id,creator,kind,title,subject_name,starts_at,created_at,share_code,sealed,opens_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,g.id,userId,m.kind,m.title,m.subject||null,starts,now,newCode(),!!opens,opens]);
 const friends=m.calls.some(c=>c.answerType==='friend')?await friendOptions(tx,g.id).catch(()=>fail('Add at least one friend to the group first.')):[];
 const ids:string[]=[];
 for(const [pos,c] of m.calls.entries())ids.push(await insertCall(tx,{groupId:g.id,userId,momentId:id,starts,opens,round:weekly?round!:null,friends,pos},c,fail));
 return{momentId:id,questionIds:ids};
}

type CallInput={text:string;answerType:'friend'|'choice';options?:string[]};
async function insertCall(tx:Transaction,ctx:{groupId:string;userId:string;momentId:string;starts:Date;opens:Date|null;round:{id:string;deadline_at:Date}|null;friends:string[];pos:number},c:CallInput,fail:(m:string)=>never){
 let options:string[]|null;try{options=c.answerType==='friend'?ctx.friends:cleanOptions(c.options)}catch(e){fail((e as Error).message)}
 const q=randomUUID();
 // Results: right after a Moment (two days to settle it), or from the opening date for sealed ones.
 const event=ctx.round?ctx.round.deadline_at:ctx.opens||new Date(ctx.starts.getTime()+2*86400000);
 await tx.query('INSERT INTO questions(id,group_id,creator,text,locks_at,round_id,scope,event_at,options,answer_type,moment_id,slot,moment_pos) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
  [q,ctx.groupId,ctx.userId,c.text,ctx.starts,ctx.round?.id||null,ctx.round?'weekly':'longterm',event,options!?JSON.stringify(options!):null,c.answerType,ctx.momentId,'moment',ctx.pos]);
 return q;
}
/** Sealed predictions are written together: anyone in the group can add one until the seal date. */
export async function addMomentCall(tx:Transaction,g:{id:string},userId:string,momentId:unknown,input:unknown,now:Date,fail:(m:string)=>never){
 const m=(await tx.query<{id:string;starts_at:Date;opens_at:Date|null;sealed:boolean}>('SELECT id,starts_at,opens_at,sealed FROM moments WHERE id=$1 AND group_id=$2',[String(momentId),g.id])).rows[0];
 if(!m)fail('Moment not found.');if(!m.sealed)fail('Only sealed predictions take new calls from everyone.');
 if(now>=new Date(m.starts_at))fail('These are sealed already.');
 const count=Number((await tx.query<{n:string}>('SELECT count(*) n FROM questions WHERE moment_id=$1 AND NOT superseded',[m.id])).rows[0].n);if(count>=20)fail('That’s 20 predictions: enough for one capsule.');
 const c=momentInput.shape.calls.element.parse(input);
 const friends=c.answerType==='friend'?await friendOptions(tx,g.id).catch(()=>fail('Add at least one friend to the group first.')):[];
 return insertCall(tx,{groupId:g.id,userId,momentId:m.id,starts:new Date(m.starts_at),opens:m.opens_at?new Date(m.opens_at):null,round:null,friends,pos:count},c,fail);
}
/** A sealed Moment's call stays closed until its opening date. */
export async function sealedUntil(tx:Transaction,questionId:string){
 const r=(await tx.query<{opens_at:Date|null}>('SELECT m.opens_at FROM questions q JOIN moments m ON m.id=q.moment_id WHERE q.id=$1 AND m.sealed',[questionId])).rows[0];return r?.opens_at?new Date(r.opens_at):null;
}
