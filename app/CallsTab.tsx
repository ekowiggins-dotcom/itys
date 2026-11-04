'use client';
import {Faces,Icon,Badge,Split,Crest} from './ui';
import {type Call,type Sections,type Snapshot,answersOf,label,reveal,outcome,potential} from './calls';
import {countdown,when} from './format';

type Act={pick:(c:Call,answer?:string)=>void;reveal:(c:Call)=>void;result:(c:Call)=>void;resolve:(c:Call,mode:'set'|'judge')=>void;dispute:(c:Call)=>void;share:(c:Call)=>void};
type Ctx={me?:string;meName?:string;names:Record<string,string>;now:number;snaps:Snapshot[];admin:boolean;activeIds:Set<string>;judgeFor:Set<string>;disputeMs:number;busy:boolean};

const knowIn=(c:Call)=>c.event_at?'We’ll know in '+new Date(c.event_at).toLocaleDateString('en-GB',{month:'long'}):'Later';
function closes(c:Call,now:number){const left=Date.parse(c.locks_at)-now;return left<6*3600000?'Locks in '+countdown(c.locks_at,now):'Picks close '+when(c.locks_at,now)}
function ShareButton({c,act}:{c:Call;act:Act}){return <button className="c-icon-btn" aria-label={'Share “'+c.text+'”'} onClick={e=>{e.stopPropagation();act.share(c)}}><Icon name="share" size={18}/></button>}

export function SectionTitle({children,count}:{children:React.ReactNode;count?:number}){return <div className="c-section"><h2>{children}</h2>{!!count&&<span className="c-count">{count}</span>}</div>}

/** The two clubs, kickoff and why this match is in. */
export function MatchHead({c,dark=false}:{c:Call;dark?:boolean}){const m=c.match!;
 return <div className={'c-match'+(dark?' dark':'')}><Crest team={m.home}/><div className="c-match-mid"><b>{m.home}</b><span>{c.state==='settled'&&m.home90!=null?m.home90+' – '+m.away90:'vs'}</span><b>{m.away}</b></div><Crest team={m.away}/></div>;
}
const marketLine=(c:Call)=>c.market==='over_under'?'3 or more goals?':c.market==='exact_score'?'Call the exact score':'Who wins?';
const byLine=(c:Call,ctx:Ctx)=>c.match?(c.match.league||'Football'):c.creator===ctx.me?'your call':'by '+c.creator_name;

export function YourTurnCard({c,ctx,act,first}:{c:Call;ctx:Ctx;act:Act;first:boolean}){
 if(c.match)return <MatchTurnCard c={c} ctx={ctx} act={act} first={first}/>;
 const pickers=(c.picker_ids||[]).map(id=>ctx.names[id]).filter(Boolean);const long=c.scope==='longterm';
 return <article className={'c-card turn'+(first?' first':'')}>
  <div className="c-card-top">{long?<Badge tone="later">{knowIn(c)}</Badge>:<Badge tone={Date.parse(c.locks_at)-ctx.now<6*3600000?'soon':'neutral'}>{closes(c,ctx.now)}</Badge>}<span className="c-by">{byLine(c,ctx)}<ShareButton c={c} act={act}/></span></div>
  <h3>{c.text}</h3>
  <div className={'c-options mini'+(answersOf(c).length>2?' grid':' pair')}>{answersOf(c).map(a=><button key={a} className="c-opt" onClick={()=>act.pick(c,a)}>{label(a,c)}</button>)}</div>
  <div className="c-who">{pickers.length?<><Faces names={pickers} size={22}/><span>{pickers.length===1?pickers[0]+' is in':pickers.length<=3?pickers.slice(0,-1).join(', ')+' and '+pickers.at(-1)+' are in':pickers.length+' friends are in'}. Make your call to see how they’re split.</span></>:<span>Nobody’s in yet. Be first.</span>}</div>
 </article>;
}

function MatchTurnCard({c,ctx,act,first}:{c:Call;ctx:Ctx;act:Act;first:boolean}){
 const pickers=(c.picker_ids||[]).map(id=>ctx.names[id]).filter(Boolean),answers=answersOf(c);
 return <article className={'c-card turn match'+(first?' first':'')}>
  <div className="c-card-top"><Badge tone={Date.parse(c.locks_at)-ctx.now<6*3600000?'soon':'neutral'}>{Date.parse(c.locks_at)-ctx.now<6*3600000?'Kicks off in '+countdown(c.locks_at,ctx.now):'Kick-off '+when(c.locks_at,ctx.now)}</Badge><span className="c-by">{byLine(c,ctx)}<ShareButton c={c} act={act}/></span></div>
  <MatchHead c={c}/>
  <p className="c-market">{marketLine(c)}</p>
  {c.market==='exact_score'?<button className="c-opt wide" onClick={()=>act.pick(c)}>Pick the score</button>:<div className={'c-options mini'+(answers.length>2?' three':' pair')}>{answers.map(a=><button key={a} className="c-opt" onClick={()=>act.pick(c,a)}>{label(a,c)}</button>)}</div>}
  <div className="c-who">{pickers.length?<><Faces names={pickers} size={22}/><span>{pickers.length===1?pickers[0]+' is in':pickers.length+' friends are in'}. Make your call to see how they’re split.</span></>:<span>{c.match?.reason||'Nobody’s in yet. Be first.'}</span>}</div>
 </article>;
}

export function InRow({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const about=c.subject_id===ctx.me;const long=c.scope==='longterm';
 return <article className="c-row">
  <div className="c-row-main">{c.match&&<span className="c-row-kick">{byLine(c,ctx)}</span>}<h3>{c.text}</h3>{c.split&&<Split answers={answersOf(c)} counts={c.split} mine={c.answer} label={a=>label(a,c)} compact/>}<p>{about?'It’s about you, so you sit this one out':long?(c.answer?'You said '+label(c.answer,c):'')+' · '+(c.picked||0)+' in':'You said '+label(c.answer||'',c)+' · '+(c.picked||0)+' in'}</p></div>
  <div className="c-row-side">{long?<Badge tone="later">{knowIn(c)}</Badge>:<Badge tone="neutral">{c.match?'Kick-off '+when(c.locks_at,ctx.now):closes(c,ctx.now)}</Badge>}<div className="c-row-actions"><ShareButton c={c} act={act}/>{!about&&ctx.now<Date.parse(c.locks_at)&&<button className="c-chip" onClick={()=>act.pick(c)}>Change</button>}</div></div>
 </article>;
}

export function LockedCard({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const groups=reveal(c,ctx.snaps),total=groups.reduce((n,g)=>n+g.names.length,0),max=Math.max(1,...groups.map(g=>g.names.length));
 const creatorLeft=!ctx.activeIds.has(c.creator),canSet=c.state==='open'&&(c.creator===ctx.me||(ctx.admin&&creatorLeft));
 const by=c.proposed_by||c.creator,proposer=by===ctx.me?'You':ctx.names[by]||c.creator_name;
 const windowEnds=c.proposed_at?Date.parse(c.proposed_at)+ctx.disputeMs:0,canDispute=c.state==='proposed'&&ctx.now<windowEnds&&c.proposed_by!==ctx.me;
 const judge=c.state==='disputed'&&ctx.judgeFor.has(c.id);
 return <article className="c-card locked">
  <div className="c-card-top"><span className="c-kick">{c.match?(Date.parse(c.locks_at)+2.5*3600000>ctx.now?'Playing now':'Full time soon'):c.state==='proposed'?'Result’s in':c.state==='disputed'?'Being checked':'Locked'}</span><span className="c-by light">{total} {total===1?'pick':'picks'}</span></div>
  {c.match?<><MatchHead c={c} dark/><p className="c-market light">{marketLine(c)}</p></>:<h3>{c.text}</h3>}
  {total>0&&<div className="c-bars">{groups.filter(g=>g.names.length).sort((a,b)=>b.names.length-a.names.length).slice(0,4).map(g=><div key={g.answer} className={'c-bar-row'+(c.proposed_answer===g.answer?' hit':'')}><span>{label(g.answer,c)} <em className="c-worth">+{potential(c,g.names.length,total)}</em></span><div className="c-bar"><i style={{width:(g.names.length/max*100)+'%'}}/></div><Faces names={g.names.map(n=>n.name)} size={20} ring="#17201B" max={3}/></div>)}</div>}
  {c.match&&c.state==='open'&&<p className="c-status">Scores itself at full time (90 minutes).</p>}
  {!c.match&&c.state==='open'&&(canSet?<button className="c-btn small" onClick={()=>act.resolve(c,'set')}>What happened?</button>:<p className="c-status">Waiting for {c.creator_name} to say what happened.</p>)}
  {c.state==='proposed'&&<p className="c-status"><b>{proposer==='You'?'You said':proposer+' says'}: {label(c.proposed_answer||'',c)}.</b> {canDispute?<>Counts in {countdown(windowEnds,ctx.now)}. <button className="c-inline" disabled={ctx.busy} onClick={()=>act.dispute(c)}>Not right? Say so</button></>:'Counts soon.'}</p>}
  {c.state==='disputed'&&(judge?<button className="c-btn small" onClick={()=>act.resolve(c,'judge')}>You’re the judge: decide</button>:<p className="c-status">Someone said that’s not right. A friend who stayed out of it decides.</p>)}
  {total>0&&<button className="c-link light" onClick={()=>act.reveal(c)}>See who said what <Icon name="arrow" size={16}/></button>}
 </article>;
}

export function LaterCard({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const open=ctx.now<Date.parse(c.locks_at);
 return <article className="c-card later">
  <div className="c-card-top"><Badge tone="later">{knowIn(c)}</Badge><span className="c-by">by {c.creator_name}<ShareButton c={c} act={act}/></span></div>
  <h3>{c.text}</h3>
  {c.split&&<Split answers={answersOf(c)} counts={c.split} mine={c.answer} label={a=>label(a,c)} compact/>}
  <div className="c-later-foot"><span>{c.subject_id===ctx.me?'About you · sitting out':c.answer?<>You said <b>{label(c.answer,c)}</b></>:'You didn’t pick'} · {c.picked||0} in</span><span>{open?<button className="c-chip" onClick={()=>act.pick(c)}>{c.answer?'Change':'Pick'}</button>:'Picks closed'}</span></div>
 </article>;
}

export function ResultRow({c,act}:{c:Call;act:Act}){
 const o=outcome(c);
 return <button className={'c-result-row '+o.tone} onClick={()=>act.result(c)}>
  <span className="c-row-main"><b>{c.text}</b><small>{c.state==='void'?'Called off':c.match&&c.match.home90!=null?'Full time '+c.match.home90+'–'+c.match.away90+(c.market==='result'?'':' · '+label(c.result_answer||'',c)):label(c.result_answer||'',c)+' it was'}</small></span>
  <span className="c-outcome">{o.tone==='win'?<>+{Math.round((c.points_tenths||0)/10)}</>:o.tone==='void'?'Back':o.tone==='miss'?'0':'–'}</span>
 </button>;
}

export function CallsList({s,ctx,act,football}:{s:Sections;ctx:Ctx;act:Act;football?:React.ReactNode}){
 return <>
  {s.yourTurn.length>0&&<><SectionTitle count={s.yourTurn.length}>Your turn</SectionTitle>{s.yourTurn.map((c,i)=><YourTurnCard key={c.id} c={c} ctx={ctx} act={act} first={i===0}/>)}</>}
  {football}
  {s.locked.length>0&&<><SectionTitle>Locked</SectionTitle>{s.locked.map(c=><LockedCard key={c.id} c={c} ctx={ctx} act={act}/>)}</>}
  {s.inIt.length>0&&<><SectionTitle>You’re in</SectionTitle>{s.inIt.map(c=><InRow key={c.id} c={c} ctx={ctx} act={act}/>)}</>}
  {s.later.length>0&&<><SectionTitle>We’ll know later</SectionTitle>{s.later.map(c=><LaterCard key={c.id} c={c} ctx={ctx} act={act}/>)}</>}
  {s.results.length>0&&<><SectionTitle>Results</SectionTitle><div className="c-results">{s.results.map(c=><ResultRow key={c.id} c={c} act={act}/>)}</div></>}
  {s.hidden.length>0&&<p className="c-hint">{s.hidden.length} {s.hidden.length===1?'call is':'calls are'} hidden while an admin takes a look. See Group → Safety.</p>}
 </>;
}
export type {Ctx as CallsCtx,Act as CallsAct};
