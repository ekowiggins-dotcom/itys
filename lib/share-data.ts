import {db} from './db';import {reconcile} from './service';import {weeklyViews} from './rounds';import {betCard,winnerCard} from './sharing';
export async function publicShare(invite:string,target:{questionId?:string;roundId?:string;winner?:boolean},now=new Date()){
 await reconcile(invite,now);const d=await db();
 return d.transaction(async tx=>{
 const group=(await tx.query<{id:string;name:string}>('SELECT id,name FROM groups WHERE invite=$1',[invite])).rows[0];if(!group)throw Error('Share link not found.');
 if(target.winner){const round=(await weeklyViews(tx,group.id)).find(r=>r.id===target.roundId);if(!round)throw Error('Round not found.');return{card:winnerCard(group.name,round),roundId:round.id};}
 const q=(await tx.query<{id:string;text:string;market:string;round_id:string|null;picked:number}>('SELECT q.id,q.text,q.market,q.round_id,(SELECT count(*)::int FROM predictions p WHERE p.question_id=q.id) picked FROM questions q WHERE q.id=$1 AND q.group_id=$2 AND NOT q.superseded AND q.moderation_state=\'visible\'',[target.questionId,group.id])).rows[0];if(!q)throw Error('Bet not found.');
 // Share previews deliberately contain no names, selections, stakes or crowd distribution.
 return{card:betCard(group.name,q.text,q.picked,q.market==='result'?'Home / Draw / Away':q.market==='exact_score'?'Exact score':q.market==='over_under'?'Over / Under 2.5':'Yes / No'),questionId:q.id,roundId:q.round_id||undefined};
 });
}
