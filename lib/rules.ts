/** Every pick counts the same. Nobody spends or chooses points: they're set for each answer when picks close (see callPoints). */
export const PICK_POINTS=10;

/**
 * What a right answer is worth, set the moment picks close from how the group split. The same rule for every call, football or not.
 * 10 if everyone said the same, up to 40 the fewer friends agreed: 10 + 30 × (1 − share who said it). Wrong: 0. Nothing is spent.
 */
export function callPoints(o:{same:number;total:number}){
 const share=o.total?o.same/o.total:1;
 return Math.round(10+30*(1-share));
}

export const DAY_MS=86400000;
export function disputeCutoff(proposedAt:number,resolutionAt:number,windowMs=DAY_MS){return Math.min(proposedAt+windowMs,resolutionAt)}
export function pendingAllocation(settledAt:number,startsAt:number|null,now:number):'pending'|'credited'|'expired'{
 const cutoff=settledAt+30*DAY_MS;
 if(startsAt!==null&&startsAt>=settledAt&&startsAt<=cutoff&&startsAt<=now)return 'credited';
 return now>cutoff?'expired':'pending';
}
export function departureRule(scope:string,locked:boolean){return !locked?'withdrawn':scope==='weekly'?'retained':'forfeited'}
/** Kept for older callers: a right call's score in tenths. */
export function scoreTenths(_stake:number,same:number,total:number){return callPoints({same,total})*10}

export type Standing={user_id:string;name:string;active:boolean;points_tenths:number;exact_correct:number;rank:number};
export function rankStandings(rows:Omit<Standing,'rank'>[]):Standing[]{
 const sorted=[...rows].sort((a,b)=>b.points_tenths-a.points_tenths||b.exact_correct-a.exact_correct||a.name.localeCompare(b.name)||a.user_id.localeCompare(b.user_id));
 let rank=1;return sorted.map((row,i)=>{if(i&& (row.points_tenths!==sorted[i-1].points_tenths||row.exact_correct!==sorted[i-1].exact_correct))rank=i+1;return {...row,rank}});
}
