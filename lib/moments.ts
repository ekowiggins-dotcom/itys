// Moments: a bundle of calls around one occasion. Same calls, same scoring; they just close together and end with one result.
import {randomUUID} from 'node:crypto';
import type {Transaction} from '@electric-sql/pglite';
import {z} from 'zod';
import {friendOptions} from './friends';
import {cleanOptions} from './football/rules';
import {newCode} from './short-links';

import {MOMENT_KINDS} from './moment-starters';
export {MOMENT_KINDS,starters,type MomentKind} from './moment-starters';

export const momentInput=z.object({kind:z.enum(MOMENT_KINDS),title:z.string().trim().min(2).max(60),subject:z.string().trim().max(60).optional(),startsAt:z.iso.datetime(),
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
 const round=(await tx.query<{id:string;deadline_at:Date}>("SELECT id,deadline_at FROM rounds WHERE group_id=$1 AND state='live' AND opens_at<=$2 AND deadline_at>$2 ORDER BY opens_at DESC LIMIT 1",[g.id,now])).rows[0];
 const weekly=!!round&&starts<=new Date(round.deadline_at);
 const id=randomUUID();
 await tx.query('INSERT INTO moments(id,group_id,creator,kind,title,subject_name,starts_at,created_at,share_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,g.id,userId,m.kind,m.title,m.subject||null,starts,now,newCode()]);
 const friends=m.calls.some(c=>c.answerType==='friend')?await friendOptions(tx,g.id).catch(()=>fail('Add at least one friend to the group first.')):[];
 const ids:string[]=[];
 for(const [pos,c] of m.calls.entries()){
  let options:string[]|null;try{options=c.answerType==='friend'?friends:cleanOptions(c.options)}catch(e){fail((e as Error).message)}
  const q=randomUUID();ids.push(q);
  // Results come in during or right after: long-term calls get two days after the start to be settled.
  await tx.query('INSERT INTO questions(id,group_id,creator,text,locks_at,round_id,scope,event_at,options,answer_type,moment_id,slot,moment_pos) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
   [q,g.id,userId,c.text,starts,weekly?round!.id:null,weekly?'weekly':'longterm',weekly?round!.deadline_at:new Date(starts.getTime()+2*86400000),options!?JSON.stringify(options!):null,c.answerType,id,'moment',pos]);
 }
 return{momentId:id,questionIds:ids};
}
