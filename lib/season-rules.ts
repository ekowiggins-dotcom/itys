export type SeasonRoundInput={id:string;opens_at:string;state:string;eligible:boolean;missed:boolean;raw_score:string};
export type SeasonRound=SeasonRoundInput & {points_tenths:number;dropped:boolean};
const SCALE=1_000_000_000_000n;
export function decimalUnits(value:string){const [whole,fraction='']=value.split('.');return BigInt(whole)*SCALE+BigInt(fraction.padEnd(12,'0').slice(0,12))}
export function displayTenths(units:bigint){return Number((units+50_000_000_000n)/100_000_000_000n)}
export function dropCount(completedEligible:number){return completedEligible>=8?2:completedEligible>=4?1:0}
export function seasonTotals(input:SeasonRoundInput[],longTermRaw:string[]){
 const rounds:SeasonRound[]=input.map(r=>({...r,points_tenths:displayTenths(decimalUnits(r.raw_score)),dropped:false}));
 const completed=rounds.filter(r=>r.eligible&&r.state==='final');const count=dropCount(completed.length);
 const lowest=[...completed].sort((a,b)=>a.points_tenths-b.points_tenths||Number(b.missed)-Number(a.missed)||a.opens_at.localeCompare(b.opens_at)||a.id.localeCompare(b.id)).slice(0,count);
 for(const r of lowest)r.dropped=true;
 const raw=rounds.filter(r=>r.eligible&&!['skipped','planned'].includes(r.state)).reduce((s,r)=>s+decimalUnits(r.raw_score),0n);
 const kept=rounds.filter(r=>r.eligible&&!r.dropped&&!['skipped','planned'].includes(r.state)).reduce((s,r)=>s+decimalUnits(r.raw_score),0n);
 const long=longTermRaw.reduce((s,v)=>s+decimalUnits(v),0n);
 return{rounds,completedEligible:completed.length,dropCount:count,weeklyTenths:displayTenths(raw),keptWeeklyTenths:displayTenths(kept),droppedTenths:displayTenths(raw-kept),longTermTenths:displayTenths(long),totalTenths:displayTenths(kept+long)};
}
export function seasonPhase(s:{starts_at:Date|string;ends_at:Date|string;frozen_at:Date|string|null},now:Date){return s.frozen_at?'frozen':now<new Date(s.starts_at)?'scheduled':now>=new Date(s.ends_at)?'provisional':'active'}
