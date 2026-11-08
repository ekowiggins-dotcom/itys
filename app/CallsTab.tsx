'use client';
import {revealHeadline} from '../lib/reveal';
import {t,L,lang} from './i18n';
import {Face,Faces,Icon,Badge,Split,Tally,Crest} from './ui';
import {type Call,type Sections,type Snapshot,answersOf,label,reveal,outcome} from './calls';
import {countdown,when} from './format';
import {useState} from 'react';

type Act={pick:(c:Call,answer?:string)=>void;reveal:(c:Call)=>void;result:(c:Call)=>void;resolve:(c:Call,mode:'set'|'judge')=>void;dispute:(c:Call)=>void;vote:(c:Call,answer:string)=>void;share:(c:Call)=>void;setResolver:(c:Call,userId:string)=>void};
type Ctx={me?:string;meName?:string;names:Record<string,string>;now:number;snaps:Snapshot[];admin:boolean;activeIds:Set<string>;judgeFor:Set<string>;disputeMs:number;busy:boolean;adminId:string;people:{id:string;name:string}[]};

const knowIn=(c:Call)=>c.event_at?L('We’ll know in ','Belli olacağı ay: ')+new Date(c.event_at).toLocaleDateString(L('en-GB','tr-TR'),{month:'long'}):t('Later');
function closes(c:Call,now:number){const left=Date.parse(c.locks_at)-now;return left<6*3600000?L('Locks in ','Kilitlenmesine ')+countdown(c.locks_at,now):L('Picks close ','Kapanış: ')+when(c.locks_at,now)}
function ShareButton({c,act}:{c:Call;act:Act}){return <button className="c-icon-btn" aria-label={t('Share “')+c.text+'”'} onClick={e=>{e.stopPropagation();act.share(c)}}><Icon name="share" size={18}/></button>}

export function SectionTitle({children,count}:{children:React.ReactNode;count?:number}){return <div className="c-section"><h2>{children}</h2>{!!count&&<span className="c-count">{count}</span>}</div>}

/** The two clubs, kickoff and why this match is in. */
export function MatchHead({c,dark=false}:{c:Call;dark?:boolean}){const m=c.match!;
 return <div className={'c-match'+(dark?' dark':'')}><Crest team={m.home}/><div className="c-match-mid"><b>{m.home}</b><span>{c.state==='settled'&&m.home90!=null?m.home90+' – '+m.away90:'vs'}</span><b>{m.away}</b></div><Crest team={m.away}/></div>;
}
/** Who says what happened: whoever posted the call, or whoever they handed it to. Two days late, anyone can. */
export const resolverOf=(c:Call,_ctx:Ctx)=>c.resolver_id||c.creator;
const decidedAt=(c:Call)=>Date.parse(c.scope==='longterm'&&c.event_at?c.event_at:c.locks_at);
export const anyoneCanSettle=(c:Call,ctx:Ctx)=>ctx.now>=decidedAt(c)+2*ctx.disputeMs||!ctx.activeIds.has(resolverOf(c,ctx));
export const canSettle=(c:Call,ctx:Ctx)=>c.state==='open'&&c.subject_id!==ctx.me&&(resolverOf(c,ctx)===ctx.me||anyoneCanSettle(c,ctx));
function SettledBy({c,ctx,act,light=false}:{c:Call;ctx:Ctx;act:Act;light?:boolean}){
 const [open,setOpen]=useState(false);if(c.match||c.state!=='open')return null;
 const r=resolverOf(c,ctx),who=r===ctx.me?L('You say','Sonucu sen gireceksin'):L((ctx.names[r]||c.creator_name)+' says','Sonucu '+(ctx.names[r]||c.creator_name)+' girecek');const canHand=ctx.admin||c.creator===ctx.me;
 return <div className={'c-settler'+(light?' light':'')} onClick={e=>e.stopPropagation()}>
  <span>{who}{L(' what happened','')}{canHand&&<> · <button className="c-inline" onClick={()=>setOpen(!open)}>{open?t('Done'):r===ctx.me?t('Hand it to someone'):t('Change')}</button></>}</span>
  {open&&<div className="c-about small">{ctx.people.map(p=><button type="button" key={p.id} className={r===p.id?'on':''} aria-pressed={r===p.id} disabled={ctx.busy} onClick={()=>{if(p.id!==r)act.setResolver(c,p.id);setOpen(false)}}><Face name={p.name} size={22}/>{p.id===ctx.me?t('You'):p.name}</button>)}</div>}
 </div>;
}
const byLine=(c:Call,ctx:Ctx)=>c.match?(c.match.league||'Football'):c.creator===ctx.me?L('your call','senin sorun'):L('by '+c.creator_name,c.creator_name+' sordu');

export function YourTurnCard({c,ctx,act,first}:{c:Call;ctx:Ctx;act:Act;first:boolean}){
 if(c.match)return <MatchTurnCard c={c} ctx={ctx} act={act} first={first}/>;
 const pickers=(c.picker_ids||[]).map(id=>ctx.names[id]).filter(Boolean);const long=c.scope==='longterm';
 return <article className={'c-card turn'+(first?' first':'')}>
  <div className="c-card-top">{long?<Badge tone="later">{knowIn(c)}</Badge>:<Badge tone={Date.parse(c.locks_at)-ctx.now<6*3600000?'soon':'neutral'}>{closes(c,ctx.now)}</Badge>}<span className="c-by">{byLine(c,ctx)}<ShareButton c={c} act={act}/></span></div>
  <h3>{c.text}</h3>
  {c.answer_type==='friend'?<div className="c-face-row">{answersOf(c).slice(0,6).map(a=><button key={a} onClick={()=>act.pick(c,a)} aria-label={a}><Face name={a} size={44}/><small>{a}</small></button>)}{answersOf(c).length>6&&<button onClick={()=>act.pick(c)} aria-label={t("More friends")}><span className="c-more-faces">+{answersOf(c).length-6}</span><small>more</small></button>}</div>
  :<div className={'c-options mini'+(answersOf(c).length>2?' grid':' pair')}>{answersOf(c).map(a=><button key={a} className="c-opt" onClick={()=>act.pick(c,a)}>{label(a,c)}</button>)}</div>}
  <div className="c-who">{pickers.length?<><Faces names={pickers} size={22}/><span>{pickers.length===1?pickers[0]+L(' is in',' seçti'):pickers.length<=3?pickers.slice(0,-1).join(', ')+L(' and ',' ve ')+pickers.at(-1)+L(' are in',' seçti'):pickers.length+L(' friends are in',' arkadaş seçti')}{t('. Make your call to see how they’re split.')}</span></>:<span>{t('Nobody’s in yet. Be first.')}</span>}</div>
 </article>;
}

function MatchTurnCard({c,ctx,act,first}:{c:Call;ctx:Ctx;act:Act;first:boolean}){
 const pickers=(c.picker_ids||[]).map(id=>ctx.names[id]).filter(Boolean),answers=answersOf(c);
 return <article className={'c-card turn match'+(first?' first':'')}>
  <div className="c-card-top"><Badge tone={Date.parse(c.locks_at)-ctx.now<6*3600000?'soon':'neutral'}>{Date.parse(c.locks_at)-ctx.now<6*3600000?t('Kicks off in ')+countdown(c.locks_at,ctx.now):t('Kick-off ')+when(c.locks_at,ctx.now)}</Badge><span className="c-by">{byLine(c,ctx)}<ShareButton c={c} act={act}/></span></div>
  <MatchHead c={c}/>
  <p className="c-market">{t('Who wins?')}</p>
  <div className="c-options mini three">{answers.map(a=><button key={a} className="c-opt" onClick={()=>act.pick(c,a)}>{label(a,c)}</button>)}</div>
  <div className="c-who">{pickers.length?<><Faces names={pickers} size={22}/><span>{pickers.length===1?pickers[0]+L(' is in',' seçti'):pickers.length+L(' friends are in',' arkadaş seçti')}{t('. Make your call to see how they’re split.')}</span></>:<span>{c.match?.reason||t('Nobody’s in yet. Be first.')}</span>}</div>
 </article>;
}

export function InRow({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const about=c.subject_id===ctx.me;const long=c.scope==='longterm';
 return <article className="c-row">
  <div className="c-row-main">{c.match&&<span className="c-row-kick">{byLine(c,ctx)}</span>}<h3>{c.text}</h3>{!c.split&&<p>{about?t('It’s about you, so you sit this one out'):c.answer?t('You said ')+label(c.answer,c):''}</p>}</div>
  <div className="c-row-side">{long?<Badge tone="later">{knowIn(c)}</Badge>:<Badge tone="neutral">{c.match?t('Kick-off ')+when(c.locks_at,ctx.now):closes(c,ctx.now)}</Badge>}<div className="c-row-actions"><ShareButton c={c} act={act}/>{!about&&ctx.now<Date.parse(c.locks_at)&&<button className="c-chip" onClick={()=>act.pick(c)}>{t('Change')}</button>}</div></div>
  {c.split&&<Tally answers={answersOf(c)} counts={c.split} mine={c.answer} label={a=>label(a,c)} picked={c.picked||0} of={Math.max(c.picked||0,ctx.activeIds.size-(c.subject_id?1:0))}/>}
  <SettledBy c={c} ctx={ctx} act={act}/>
 </article>;
}

export function LockedCard({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const groups=reveal(c,ctx.snaps),total=groups.reduce((n,g)=>n+g.names.length,0),max=Math.max(1,...groups.map(g=>g.names.length));
 const canSet=canSettle(c,ctx),settler=ctx.names[resolverOf(c,ctx)]||c.creator_name;
 const by=c.proposed_by||c.creator,proposer=by===ctx.me?'You':ctx.names[by]||c.creator_name;
 const windowEnds=c.proposed_at?Date.parse(c.proposed_at)+ctx.disputeMs:0,canDispute=c.state==='proposed'&&ctx.now<windowEnds&&c.proposed_by!==ctx.me;
  return <article className="c-card locked">
  <div className="c-card-top"><span className="c-kick">{c.match?(Date.parse(c.locks_at)+2.5*3600000>ctx.now?t('Playing now'):t('Full time soon')):c.state==='proposed'?t('Result’s in'):c.state==='disputed'?L('Group vote','Grup oylaması'):t('Locked')}</span><span className="c-by light">{total} {total===1?'pick':'picks'}</span></div>
  {c.match?<><MatchHead c={c} dark/><p className="c-market light">{t('Who wins?')}</p></>:<h3>{c.text}</h3>}
  {c.answer_type==='friend'&&total>=2&&!c.about_you&&<p className="c-reveal-line">{revealHeadline(groups.filter(g=>g.names.length).map(g=>({name:label(g.answer,c),count:g.names.length})).sort((a,b)=>b.count-a.count),total,lang(),ctx.names[ctx.me||''])}</p>}
  {total>0&&<div className="c-bars">{groups.filter(g=>g.names.length).sort((a,b)=>b.names.length-a.names.length).slice(0,4).map(g=><div key={g.answer} className={'c-bar-row'+(c.proposed_answer===g.answer?' hit':'')}><span>{label(g.answer,c)}</span><div className="c-bar"><i style={{width:(g.names.length/max*100)+'%'}}/></div><Faces names={g.names.map(n=>n.name)} size={20} ring="#17201B" max={3}/></div>)}</div>}
  {c.match&&c.state==='open'&&<p className="c-status">{t('Scores itself at full time (90 minutes).')}</p>}
  {!c.match&&c.state==='open'&&(canSet?<>{resolverOf(c,ctx)!==ctx.me&&<p className="c-status">{L(settler+' hasn’t said, so anyone can now.',settler+' girmedi, artık herkes girebilir.')}</p>}<button className="c-btn small" onClick={()=>act.resolve(c,'set')}>{t('What happened?')}</button></>:<p className="c-status">{t('Waiting for')} {settler} {t('to say what happened.')}</p>)}
  {!c.match&&c.state==='open'&&(ctx.admin||c.creator===ctx.me)&&<SettledBy c={c} ctx={ctx} act={act} light/>}
  {c.state==='proposed'&&c.about_you&&c.proposed_by!==ctx.me?<p className="c-status">{t('The result’s in. It’s about you, so you’ll see it once it counts.')}</p>:c.state==='proposed'&&<p className="c-status"><b>{proposer==='You'?t('You said'):proposer+L(' says',' diyor')}: {label(c.proposed_answer||'',c)}.</b> {canDispute?<>{t('Counts in')} {countdown(windowEnds,ctx.now)}. <button className="c-inline" disabled={ctx.busy} onClick={()=>act.dispute(c)}>{t('Not right? Say so')}</button></>:t('Counts soon.')}</p>}
  {c.state==='disputed'&&<VotePanel c={c} ctx={ctx} act={act}/>}
  {total>0&&<button className="c-link light" onClick={()=>act.reveal(c)}>{t('See who said what')} <Icon name="arrow" size={16}/></button>}
 </article>;
}

/** A disputed result: the group votes on what actually happened. Votes are public; most votes wins, a tie keeps the settler's answer. */
function VotePanel({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const votes=c.votes||[],mine=votes.find(v=>v.user_id===ctx.me)?.answer,ends=Date.parse(c.disputed_at||c.proposed_at||'')+ctx.disputeMs;
 const settler=c.proposed_by===ctx.me?L('You','Sen'):ctx.names[c.proposed_by||'']||c.creator_name;
 if(c.about_you)return <p className="c-status">{L('Someone said the result isn’t right, so the group is voting. It’s about you, so you sit this out.','Biri sonucun yanlış olduğunu söyledi, grup oyluyor. Senin hakkında olduğu için bu oylamaya katılmazsın.')}</p>;
 return <div className="c-vote" onClick={e=>e.stopPropagation()}>
  <p className="c-vote-q"><b>{L('What actually happened?','Gerçekte ne oldu?')}</b> <span>{L(`${settler} said ${label(c.proposed_answer||'',c)}. Closes in ${countdown(ends,ctx.now)}.`,`${settler}: ${label(c.proposed_answer||'',c)}. ${countdown(ends,ctx.now)} içinde kapanır.`)}</span></p>
  {answersOf(c).map(a=>{const who=votes.filter(v=>v.answer===a).map(v=>ctx.names[v.user_id]||'?');return <button key={a} className={'c-vote-opt'+(mine===a?' on':'')} disabled={ctx.busy} aria-pressed={mine===a} onClick={()=>act.vote(c,a)}>
   <span>{label(a,c)}{a===c.proposed_answer&&<em>{L('settler','girilen')}</em>}</span>{who.length?<Faces names={who} size={20} ring="#17201B" max={4}/>:null}<b>{who.length}</b></button>})}
  <small>{mine?L('Tap another answer to change your vote.','Oyunu değiştirmek için başka bir cevaba dokun.'):L('Votes are public. Most votes wins; a tie keeps what was said.','Oylar herkese açık. En çok oy alan kazanır; eşitlikte girilen sonuç kalır.')}</small>
 </div>;
}

export function LaterCard({c,ctx,act}:{c:Call;ctx:Ctx;act:Act}){
 const open=ctx.now<Date.parse(c.locks_at);
 return <article className="c-card later">
  <div className="c-card-top"><Badge tone="later">{knowIn(c)}</Badge><span className="c-by">by {c.creator_name}<ShareButton c={c} act={act}/></span></div>
  <h3>{c.text}</h3>
  {c.split&&<Split answers={answersOf(c)} counts={c.split} mine={c.answer} label={a=>label(a,c)} compact/>}
  <SettledBy c={c} ctx={ctx} act={act}/>
  <div className="c-later-foot"><span>{c.subject_id===ctx.me?t('About you · sitting out'):c.answer?<>{t('You said')} <b>{label(c.answer,c)}</b></>:t('You didn’t pick')} · {L((c.picked||0)+' picked',(c.picked||0)+' kişi seçti')}</span><span>{open?<button className="c-chip" onClick={()=>act.pick(c)}>{c.answer?t('Change'):t('Pick')}</button>:t('Picks closed')}</span></div>
 </article>;
}

export function ResultRow({c,act}:{c:Call;act:Act}){
 const o=outcome(c);
 return <button className={'c-result-row '+o.tone} onClick={()=>act.result(c)}>
  <span className="c-row-main"><b>{c.text}</b><small>{c.state==='void'?t('Called off'):c.match&&c.match.home90!=null?t('Full time ')+c.match.home90+'–'+c.match.away90:label(c.result_answer||'',c)+L(' it was',' oldu')}</small></span>
  <span className="c-outcome">{o.tone==='win'?<>+{Math.round((c.points_tenths||0)/10)}</>:o.tone==='void'?t('Back'):o.tone==='miss'?'0':'–'}</span>
 </button>;
}

export function CallsList({s,ctx,act,football}:{s:Sections;ctx:Ctx;act:Act;football?:React.ReactNode}){
 return <>
  {s.yourTurn.length>0&&<><SectionTitle count={s.yourTurn.length}>{t('Your turn')}</SectionTitle>{s.yourTurn.map((c,i)=><YourTurnCard key={c.id} c={c} ctx={ctx} act={act} first={i===0}/>)}</>}
  {football}
  {s.locked.length>0&&<><SectionTitle>{t('Locked')}</SectionTitle>{s.locked.map(c=><LockedCard key={c.id} c={c} ctx={ctx} act={act}/>)}</>}
  {s.inIt.length>0&&<><SectionTitle>{t('You’re in')}</SectionTitle>{s.inIt.map(c=><InRow key={c.id} c={c} ctx={ctx} act={act}/>)}</>}
  {s.later.length>0&&<><SectionTitle>{t('We’ll know later')}</SectionTitle>{s.later.map(c=><LaterCard key={c.id} c={c} ctx={ctx} act={act}/>)}</>}
  {s.results.length>0&&<><SectionTitle>{t('Results')}</SectionTitle><div className="c-results">{s.results.map(c=><ResultRow key={c.id} c={c} act={act}/>)}</div></>}
  {s.hidden.length>0&&<p className="c-hint">{s.hidden.length} {L(s.hidden.length===1?'call is':'calls are','tahmin')} {t('hidden while an admin takes a look. See Group → Safety.')}</p>}
 </>;
}
export type {Ctx as CallsCtx,Act as CallsAct};
