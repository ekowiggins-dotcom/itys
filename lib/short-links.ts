import {randomBytes} from 'node:crypto';
import type {Transaction} from '@electric-sql/pglite';
import {db} from './db';
// Short share links: calld.app/c/k7Qm2x. One code per group invite, per call and per weekly result.
// No look-alike characters (0/O, 1/l/I), so a code read aloud or retyped still works.
const ALPHABET='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(length=7){let s='';for(const b of randomBytes(length))s+=ALPHABET[b%ALPHABET.length];return s}
export const validCode=(code:string)=>/^[A-Za-z0-9]{5,16}$/.test(code);
export {shortLink} from './sharing';

/** Give the group, its calls and its rounds a code if they don't have one yet. */
export async function ensureShareCodes(tx:Transaction,groupId:string){
 const missing=(await tx.query<{t:string;id:string}>("SELECT 'groups' t,id FROM groups WHERE id=$1 AND share_code IS NULL UNION ALL SELECT 'questions',id FROM questions WHERE group_id=$1 AND share_code IS NULL UNION ALL SELECT 'rounds',id FROM rounds WHERE group_id=$1 AND share_code IS NULL",[groupId])).rows;
 for(const row of missing){
  const table=row.t==='groups'?'groups':row.t==='questions'?'questions':'rounds';
  await tx.query(`UPDATE ${table} SET share_code=$2 WHERE id=$1 AND share_code IS NULL`,[row.id,newCode()]);
 }
}

export type ShareTarget={invite:string;questionId?:string;roundId?:string;winner?:boolean;
 /** "For Ege": the card tells Ege how many friends picked him (friend calls only). */
 forName?:string};
/** What a short code points at. Unknown or malformed codes return null. */
export async function resolveCode(code:string):Promise<ShareTarget|null>{
 if(!validCode(code))return null;
 const d=await db();
 const row=(await d.query<{invite:string;question_id:string|null;round_id:string|null}>(
  `SELECT g.invite,NULL question_id,NULL round_id FROM groups g WHERE g.share_code=$1
   UNION ALL SELECT g.invite,q.id,q.round_id FROM questions q JOIN groups g ON g.id=q.group_id WHERE q.share_code=$1
   UNION ALL SELECT g.invite,NULL,r.id FROM rounds r JOIN groups g ON g.id=r.group_id WHERE r.share_code=$1 LIMIT 1`,[code])).rows[0];
 if(!row)return null;
 if(row.question_id)return {invite:row.invite,questionId:row.question_id,roundId:row.round_id||undefined};
 if(row.round_id)return {invite:row.invite,roundId:row.round_id,winner:true};
 return {invite:row.invite};
}
