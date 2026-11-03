'use client';
import SharePanel from './SharePanel';
import {winnerCard,shareLink} from '../lib/sharing';
import {when} from './format';
export type Standing={user_id:string;name:string;active:boolean;points_tenths:number;exact_correct:number;rank:number};
export type WeeklyRound={group_type?:'Friends'|'Football'|'Mixed';timezone?:string;pick_end_at?:string;content_ready?:boolean;skip_reason?:string|null;id:string;opens_at:string;deadline_at:string;publish_at:string;state:string;pending:number;standings:Standing[];winners:Standing[]};
export default function WeeklyBoard({rounds,selected,onSelect,suggestions,onTemplate,groupName,invite,origin,demo}:{groupName:string;invite:string;origin:string;demo?:boolean;rounds:WeeklyRound[];selected?:WeeklyRound;onSelect:(id:string)=>void;suggestions?:unknown[];onTemplate:()=>void}){
 if(!selected)return <section className="weekly-board" id="weekly-scoreboard" tabIndex={-1}><div className="empty"><span className="emoji">🏁</span><p>The first round opens once three friends have joined.</p></div></section>;
 const state=selected.state,final=state==='final',winners=selected.winners;const names=winners.map(w=>w.name).join(' & ');
 return <section className="weekly-board" id="weekly-scoreboard" tabIndex={-1}><div className="page-head"><h2>Weekly ranking</h2></div><div className="chips weeks" role="tablist" aria-label="Week">{rounds.filter(r=>r.state!=='planned').map((r,i)=><button key={r.id} role="tab" aria-selected={r.id===selected.id} className={r.id===selected.id?'on':''} onClick={()=>onSelect(r.id)}>{i===0&&['live','provisional','waiting_feed'].includes(r.state)?'This week':new Date(r.opens_at).toLocaleDateString('en-GB',{timeZone:selected.timezone||'UTC',month:'short',day:'numeric'})}{r.state==='live'?' · live':''}</button>)}</div>{!final&&<div className={'round-status '+state}><span className="status-dot"/>{state==='waiting_feed'?'Waiting for matches':state==='planned'?'Scheduled':state==='live'?'Live · points land as results come in':state==='provisional'?selected.pending+' results still pending':'Skipped · doesn’t count'}</div>}
 {final&&winners.length>0&&<div className="winner-card"><div className="confetti" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i}/>)}</div><span className="trophy" aria-hidden="true">🏆</span><span className="kicker">{winners.length>1?'Shared win':'Winner of the week'}</span><h3>{names}</h3><p><strong>{(winners[0].points_tenths/10).toFixed(1)}</strong> pts</p></div>}
 {state!=='skipped'&&<div className="leaderboard" role="table" aria-label="Weekly leaderboard">{selected.standings.map(s=><div className={final&&s.rank===1?'leaderboard-row winner-row':'leaderboard-row'} key={s.user_id} role="row"><span>{s.rank<=3&&s.points_tenths>0?<span className="medal">{['🥇','🥈','🥉'][s.rank-1]}</span>:<b>{s.rank}</b>}{s.name}{!s.active&&<small> · left</small>}</span><strong>{(s.points_tenths/10).toFixed(1)}<small> pts</small></strong></div>)}</div>}
 
 {state==='live'&&!!suggestions?.length&&<div className="suggestion"><strong>The group chat needs a question.</strong><p>Try: “Will everyone arrive on time this weekend?”</p><button className="secondary" onClick={onTemplate}>Use this suggestion ↗</button></div>}
 {final&&winners.length>0&&origin&&<SharePanel card={winnerCard(groupName,selected)} url={shareLink(origin,invite,{roundId:selected.id,winner:true},demo)}/>}
 {selected.skip_reason&&<p>{selected.skip_reason}</p>}
 {!final&&<small>Final standings {when(selected.publish_at,Date.now(),selected.timezone)}</small>}</section>;
}
