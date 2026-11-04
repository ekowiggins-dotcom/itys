export const DAY_MS=86400000;
export function disputeCutoff(proposedAt:number,resolutionAt:number,windowMs=DAY_MS){return Math.min(proposedAt+windowMs,resolutionAt)}
export function pendingAllocation(settledAt:number,startsAt:number|null,now:number):'pending'|'credited'|'expired'{
 const cutoff=settledAt+30*DAY_MS;
 if(startsAt!==null&&startsAt>=settledAt&&startsAt<=cutoff&&startsAt<=now)return 'credited';
 return now>cutoff?'expired':'pending';
}
export function departureRule(scope:string,locked:boolean){return !locked?'withdrawn':scope==='weekly'?'retained':'forfeited'}
// Integer rational arithmetic: half-up rounding to the displayed tenth.
export function scoreTenths(stake:number,same:number,total:number,longterm=false){
 const numerator=BigInt(longterm?20:stake)*BigInt(2*total-same)*10n;
 return Number((numerator*2n+BigInt(total))/(2n*BigInt(total)));
}

export type Standing={user_id:string;name:string;active:boolean;points_tenths:number;exact_correct:number;rank:number};
export function rankStandings(rows:Omit<Standing,'rank'>[]):Standing[]{
 const sorted=[...rows].sort((a,b)=>b.points_tenths-a.points_tenths||b.exact_correct-a.exact_correct||a.name.localeCompare(b.name)||a.user_id.localeCompare(b.user_id));
 let rank=1;return sorted.map((row,i)=>{if(i&& (row.points_tenths!==sorted[i-1].points_tenths||row.exact_correct!==sorted[i-1].exact_correct))rank=i+1;return {...row,rank}});
}
