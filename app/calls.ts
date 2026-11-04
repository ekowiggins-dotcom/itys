// How the Calls screen sorts and describes calls. Pure functions, so they can be tested without a browser.
export type Call={id:string;text:string;options?:string[]|null;scope:string;locks_at:string;event_at:string|null;state:string;creator:string;creator_name:string;subject_id?:string|null;
 answer:string|null;stake?:number|null;picked?:number;picker_ids?:string[];proposed_answer:string|null;proposed_at:string|null;proposed_by?:string|null;result_answer?:string|null;
 points_tenths:number|null;allocation?:string|null;moderation_state?:string;market?:string;fixture_id?:string|null;share_code?:string|null;round_id?:string|null;forfeited?:boolean;disputes?:number;settled_at?:string|null;
 /** Anonymous counts per answer: only sent once you've made your call, or once it locks. */
 split?:Record<string,number>};
export type Snapshot={question_id:string;user_id?:string;name:string;answer:string;stake:number;total:number};
export type Sections={yourTurn:Call[];locked:Call[];inIt:Call[];later:Call[];results:Call[];hidden:Call[]};

export const answersOf=(c:{options?:string[]|null})=>c.options?.length?c.options:['yes','no'];
export const label=(a:string)=>a==='yes'?'Yes':a==='no'?'No':a;
export const pts=(tenths:number|null|undefined)=>Math.round((tenths||0)/10);
const terminal=(s:string)=>s==='settled'||s==='void';

/** One list of calls, grouped by what you can do with each. Football matches are shown separately. */
export function sortCalls(calls:Call[],me:string|undefined,now:number,recentMs=7*86400000):Sections{
 const out:Sections={yourTurn:[],locked:[],inIt:[],later:[],results:[],hidden:[]};
 for(const c of calls){
  if(c.fixture_id)continue;
  if(c.moderation_state&&c.moderation_state!=='visible'){out.hidden.push(c);continue}
  const open=c.state==='open'&&now<Date.parse(c.locks_at),long=c.scope==='longterm';
  if(terminal(c.state)){if(!long||now-Date.parse(c.settled_at||c.locks_at)<recentMs)out.results.push(c);continue}
  if(open){if(!c.answer&&c.subject_id!==me&&!c.forfeited)out.yourTurn.push(c);else if(long)out.later.push(c);else out.inIt.push(c);continue}
  // Locked. A long-running call waits for its event; everything else waits for someone to set the result.
  if(long&&c.state==='open'&&c.event_at&&now<Date.parse(c.event_at))out.later.push(c);else out.locked.push(c);
 }
 const byLock=(a:Call,b:Call)=>Date.parse(a.locks_at)-Date.parse(b.locks_at);
 out.yourTurn.sort(byLock);out.inIt.sort(byLock);out.locked.sort(byLock);
 out.later.sort((a,b)=>Date.parse(a.event_at||a.locks_at)-Date.parse(b.event_at||b.locks_at));
 out.results.sort((a,b)=>Date.parse(b.settled_at||b.locks_at)-Date.parse(a.settled_at||a.locks_at));
 return out;
}

export type Group={answer:string;names:{name:string;id?:string;stake:number}[]};
/** Who said what, in the call's own option order, biggest group first after the reveal. */
export function reveal(call:Call,snaps:Snapshot[]):Group[]{
 const mine=snaps.filter(s=>s.question_id===call.id);
 return answersOf(call).map(a=>({answer:a,names:mine.filter(s=>s.answer===a).map(s=>({name:s.name,id:s.user_id,stake:s.stake}))}));
}
/** The score a right pick earns: points × (2 − share who agreed). A lone right call is worth nearly double. */
export function potential(stake:number,same:number,total:number){return total?Math.round(stake*(2-same/total)):stake}

/** "Three of you went Nagelsmann. Arda went alone." */
export function headline(groups:Group[],meName?:string){
 const total=groups.reduce((n,g)=>n+g.names.length,0);if(!total)return 'Nobody picked this one.';
 const sorted=[...groups].filter(g=>g.names.length).sort((a,b)=>b.names.length-a.names.length);
 const top=sorted[0],word=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
 if(sorted.length===1)return total===1?`Only ${who(top.names[0].name,meName)} picked.`:`All ${total} of you said ${label(top.answer)}.`;
 const first=top.names.length===1?`${who(top.names[0].name,meName,true)} said ${label(top.answer)}.`:`${word[top.names.length]||top.names.length} of you said ${label(top.answer)}.`;
 const alone=sorted.slice(1).find(g=>g.names.length===1);
 return first+(alone?` ${who(alone.names[0].name,meName,true)} went ${label(alone.answer)} alone.`:'');
}
const who=(name:string,me?:string,capital=false)=>name===me?(capital?'You':'you'):name;

/** Your result line on a settled call. */
export function outcome(c:Call){
 if(c.state==='void')return {tone:'void' as const,text:'Called off · points back'};
 if(!c.answer)return {tone:'none' as const,text:label(c.result_answer||'')+' it was'};
 const right=c.answer===c.result_answer;
 return right?{tone:'win' as const,text:'You called it · +'+pts(c.points_tenths)}:{tone:'miss' as const,text:'You said '+label(c.answer)};
}
