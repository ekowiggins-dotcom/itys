import {callPoints} from '../lib/rules';
// How the Calls screen sorts and describes calls. Pure functions, so they can be tested without a browser.
export type Call={id:string;text:string;options?:string[]|null;scope:string;locks_at:string;event_at:string|null;state:string;creator:string;creator_name:string;subject_id?:string|null;
 answer:string|null;stake?:number|null;picked?:number;picker_ids?:string[];proposed_answer:string|null;proposed_at:string|null;proposed_by?:string|null;result_answer?:string|null;
 points_tenths:number|null;allocation?:string|null;moderation_state?:string;market?:string;answer_type?:string;moment_id?:string|null;moment_pos?:number|null;fixture_id?:string|null;share_code?:string|null;round_id?:string|null;forfeited?:boolean;disputes?:number;settled_at?:string|null;
 /** Anonymous counts per answer: only sent once you've made your call, or once it locks. */
 split?:Record<string,number>;
 /** A football match call: the teams and kickoff, filled in from the round's fixtures. */
 match?:Match|null};
export type Match={home:string;away:string;kickoff?:string;league?:string;reason?:string;home90?:number|null;away90?:number|null};
type Labelled={options?:string[]|null;market?:string;match?:Match|null;split?:Record<string,number>};
export type Snapshot={question_id:string;user_id?:string;name:string;answer:string;stake:number;total:number};
export type Sections={yourTurn:Call[];locked:Call[];inIt:Call[];later:Call[];results:Call[];hidden:Call[]};

/** The answers you can pick. A match is the two teams and a draw. */
export function answersOf(c:Labelled):string[]{
 if(c.market==='result')return ['home','draw','away'];
 return c.options?.length?c.options:['yes','no'];
}
/** What an answer reads as: "Yes", "Fenerbahçe", "Over 2.5", "2–1". */
export function label(a:string,c?:Labelled|null){
 if(c?.market==='result'){if(a==='home')return c.match?.home||'Home';if(a==='away')return c.match?.away||'Away';if(a==='draw')return 'Draw'}
 return a==='yes'?'Yes':a==='no'?'No':a;
}
/** "Fenerbahçe – Liverpool". */
export function matchTitle(c:{match?:Match|null;text:string}){return c.match?c.match.home+' – '+c.match.away:c.text}
export const pts=(tenths:number|null|undefined)=>Math.round((tenths||0)/10);
const terminal=(s:string)=>s==='settled'||s==='void';

/** One list of calls, grouped by what you can do with each. Football matches sit in the same list. */
export function sortCalls(calls:Call[],me:string|undefined,now:number,recentMs=7*86400000):Sections{
 const out:Sections={yourTurn:[],locked:[],inIt:[],later:[],results:[],hidden:[]};
 for(const c of calls){
  if(c.moment_id)continue; // Moment calls live inside their Moment card
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
/** What an answer is worth if it's right, fixed when picks close: rarer answers score more (see lib/rules.ts). */
export function potential(same:number,total:number){return callPoints({same,total})}

/** "Three of you went Nagelsmann. Arda went alone." */
export function headline(groups:Group[],meName?:string,c?:Labelled){
 const total=groups.reduce((n,g)=>n+g.names.length,0);if(!total)return 'Nobody picked this one.';
 const sorted=[...groups].filter(g=>g.names.length).sort((a,b)=>b.names.length-a.names.length);
 const top=sorted[0],word=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
 if(sorted.length===1)return total===1?`Only ${who(top.names[0].name,meName)} picked.`:`All ${total} of you said ${label(top.answer,c)}.`;
 const first=top.names.length===1?`${who(top.names[0].name,meName,true)} said ${label(top.answer,c)}.`:`${word[top.names.length]||top.names.length} of you said ${label(top.answer,c)}.`;
 const alone=sorted.slice(1).find(g=>g.names.length===1);
 return first+(alone?` ${who(alone.names[0].name,meName,true)} went ${label(alone.answer,c)} alone.`:'');
}
const who=(name:string,me?:string,capital=false)=>name===me?(capital?'You':'you'):name;

/** Your result line on a settled call. */
export function outcome(c:Call){
 if(c.state==='void')return {tone:'void' as const,text:'Called off · doesn’t count'};
 if(!c.answer)return {tone:'none' as const,text:label(c.result_answer||'',c)+' it was'};
 const right=c.answer===c.result_answer;
 return right?{tone:'win' as const,text:'You called it · +'+pts(c.points_tenths)}:{tone:'miss' as const,text:'You said '+label(c.answer,c)};
}

// ── Moments ──
export type Moment={id:string;kind:string;title:string;subject_name:string|null;starts_at:string;creator:string;share_code:string|null;created_at:string;sealed?:boolean;opens_at?:string|null;event_key?:string|null};
/** open: picks (and, sealed, adding) still open · sealed: waiting for the opening · live: happening / opened · done: all settled. */
export type MomentStatus='open'|'sealed'|'live'|'done';
/** A Moment's calls in the order they were written, and where it stands. */
export function momentView(m:Moment,calls:Call[],now:number,me?:string){
 const list=calls.filter(c=>c.moment_id===m.id&&(!c.moderation_state||c.moderation_state==='visible')).sort((a,b)=>(a.moment_pos??0)-(b.moment_pos??0));
 const settled=list.filter(c=>c.state==='settled'),open=now<Date.parse(m.starts_at);
 const sealedNow=!!m.sealed&&!!m.opens_at&&now<Date.parse(m.opens_at);
 const status:MomentStatus=list.length&&list.every(c=>c.state==='settled'||c.state==='void')&&settled.length?'done':open?'open':sealedNow?'sealed':'live';
 const toPick=open?list.filter(c=>c.state==='open'&&!c.answer&&c.subject_id!==me&&!c.forfeited):[];
 return{calls:list,status,toPick,settled:settled.length};
}
/** "Oracle of the night": points from settled calls (rarer right answers score more), then most right. */
export function momentLeaders(list:Call[],snaps:Snapshot[]){
 const by=new Map<string,{name:string;points:number;right:number}>();
 for(const c of list){if(c.state!=='settled'||!c.result_answer)continue;const mine=snaps.filter(s=>s.question_id===c.id),right=mine.filter(s=>s.answer===c.result_answer);
  for(const s of mine){const r=by.get(s.name)||{name:s.name,points:0,right:0};by.set(s.name,r)}
  for(const s of right){const r=by.get(s.name)!;r.points+=callPoints({same:right.length,total:mine.length});r.right++}}
 return [...by.values()].sort((a,b)=>b.points-a.points||b.right-a.right||a.name.localeCompare(b.name));
}
