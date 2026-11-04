import {db} from './db';import {reconcile} from './service';import {weeklyViews} from './rounds';import {betCard,inviteCard,winnerCard} from './sharing';import {when} from '../app/format';
const MARKETS:Record<string,string[]>={result:['Home','Draw','Away'],over_under:['Over 2.5','Under 2.5'],exact_score:['Exact score']};
/** Month a long-running call resolves, e.g. "We'll know in March". */
export function knowLabel(eventAt:Date|string,zone='UTC'){return 'We’ll know in '+new Date(eventAt).toLocaleDateString('en-GB',{timeZone:zone,month:'long'})}
export async function publicShare(invite:string,target:{questionId?:string;roundId?:string;winner?:boolean},now=new Date()){
 await reconcile(invite,now);const d=await db();
 return d.transaction(async tx=>{
 const group=(await tx.query<{id:string;name:string;timezone:string}>('SELECT id,name,timezone FROM groups WHERE invite=$1',[invite])).rows[0];if(!group)throw Error('Share link not found.');
 if(target.winner){const round=(await weeklyViews(tx,group.id)).find(r=>r.id===target.roundId);if(!round)throw Error('Round not found.');return{card:winnerCard(group.name,round),roundId:round.id};}
 if(!target.questionId){
  // A group invite shows first names only: the people you'd be joining.
  const members=(await tx.query<{name:string}>('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.active ORDER BY m.joined_at LIMIT 30',[group.id])).rows.map(r=>r.name);
  return{card:inviteCard(group.name,members)};
 }
 const q=(await tx.query<{id:string;text:string;market:string;options:string[]|null;round_id:string|null;scope:string;locks_at:Date;event_at:Date|null;creator_name:string;picked:number;subject_id:string|null}>("SELECT q.id,q.text,q.market,q.options,q.subject_id,q.round_id,q.scope,q.locks_at,q.event_at,u.name creator_name,(SELECT count(*)::int FROM predictions p WHERE p.question_id=q.id) picked FROM questions q JOIN users u ON u.id=q.creator WHERE q.id=$1 AND q.group_id=$2 AND NOT q.superseded AND q.moderation_state='visible'",[target.questionId,group.id])).rows[0];if(!q)throw Error('Call not found.');
 // Previews show the question, its answers, who made it and how many are in: never who picked what, or how many points.
 const market=q.market||'custom';const options=market==='custom'?(q.options?.length?q.options:['Yes','No']):MARKETS[market]||['Yes','No'];
 const locked=now>=new Date(q.locks_at);
 const label=q.scope==='longterm'&&q.event_at?knowLabel(q.event_at,group.timezone):locked?'Picks are closed':'Picks close '+when(q.locks_at,now.getTime(),group.timezone);
 // A call about someone is shared to a chat they're probably in: the preview keeps it secret.
 if(q.subject_id&&!['settled','void'].includes((await tx.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q.id])).rows[0].state)){const card=betCard(group.name,'A secret call about a friend',q.picked,['Open it to see'],{creator:market==='custom'?q.creator_name:undefined,when:label});card.options=[];return{card,questionId:q.id,roundId:q.round_id||undefined};}
 return{card:betCard(group.name,q.text,q.picked,options,{creator:market==='custom'?q.creator_name:undefined,when:label}),questionId:q.id,roundId:q.round_id||undefined};
 });
}
