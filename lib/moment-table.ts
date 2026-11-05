/** Who called a Moment best: most points (rarer right answers score more), then most right. */
export function momentTable(rows:{user_id:string;name:string;points:number;right:number}[]){
 const sorted=[...rows].filter(r=>r.points>0).sort((a,b)=>b.points-a.points||b.right-a.right);
 const top=sorted[0];return{rows:sorted,winners:top?sorted.filter(r=>r.points===top.points&&r.right===top.right):[]};
}
