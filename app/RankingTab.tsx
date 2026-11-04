'use client';
import {useState} from 'react';
import {Face,Icon} from './ui';
import type {WeeklyRound} from './rounds-types';
import SeasonsPanel,{type SeasonView} from './SeasonsPanel';
import {type Call,type Snapshot,label,potential,pts} from './calls';
import {when} from './format';

type Row={user_id:string;name:string;active:boolean;points:number;rank:number};
/** Top three on a podium, everyone else in a list. Whole points only. */
export function Podium({rows,me}:{rows:Row[];me?:string}){
 if(!rows.length)return null;
 const [first,second,third]=rows,rest=rows.slice(3);
 const step=(r:Row|undefined,place:1|2|3)=>r?<div className={'c-step p'+place}>{place===1&&<Icon name="crown" size={28}/>}<Face name={r.name} size={place===1?64:52} ring="#17201B"/><span className="c-step-name">{r.user_id===me?'You':r.name}</span><div className="c-block"><b>{r.points}</b><small>{['1st','2nd','3rd'][place-1]}</small></div></div>:<div className={'c-step p'+place+' empty'}/>;
 return <><div className="c-podium">{step(second,2)}{step(first,1)}{step(third,3)}</div>
  {rest.length>0&&<div className="c-table">{rest.map(r=><div key={r.user_id} className={'c-table-row'+(r.user_id===me?' me':'')}><span className="c-pos">{r.rank}</span><Face name={r.name} size={32}/><span className="c-table-name">{r.user_id===me?'You':r.name}{!r.active&&<small> · left</small>}</span><b>{r.points}</b></div>)}</div>}</>;
}

/** The boldest right call this week, worked out from the reveal snapshots. */
export function callOfTheWeek(calls:Call[],snaps:Snapshot[]){
 let best:{name:string;answer:string;score:number;alone:boolean;text:string}|null=null;
 for(const c of calls){if(c.state!=='settled'||c.scope!=='weekly'||!c.result_answer)continue;const mine=snaps.filter(s=>s.question_id===c.id);const right=mine.filter(s=>s.answer===c.result_answer);
  for(const s of right){const score=potential(s.stake,right.length,mine.length);if(!best||score>best.score)best={name:s.name,answer:c.result_answer,score,alone:right.length===1&&mine.length>1,text:c.text}}}
 return best;
}

export default function RankingTab({rounds,board,onSelect,me,meName,calls,snaps,seasons,admin,busy,act,clock,onShareWinner}:{rounds:WeeklyRound[];board?:WeeklyRound;onSelect:(id:string)=>void;me?:string;meName?:string;calls:Call[];snaps:Snapshot[];seasons:SeasonView[];admin:boolean;busy:boolean;act:(p:Record<string,unknown>)=>Promise<boolean>;clock:number;onShareWinner:(r:WeeklyRound)=>void}){
 const [view,setView]=useState<'week'|'season'>('week');
 const season=seasons.find(s=>s.state==='active')||seasons[0];
 const weekRows:Row[]=(board?.standings||[]).map(s=>({user_id:s.user_id,name:s.name,active:s.active,points:pts(s.points_tenths),rank:s.rank}));
 const seasonRows:Row[]=(season?.standings||[]).map(s=>({user_id:s.user_id,name:s.name,active:s.active,points:pts(s.totalTenths),rank:s.rank}));
 const best=board&&calls.some(c=>c.round_id===board.id)?callOfTheWeek(calls.filter(c=>c.round_id===board.id),snaps):null;
 const live=board&&['live','provisional','waiting_feed'].includes(board.state);
 const visible=rounds.filter(r=>r.state!=='planned');
 return <>
  <div className="c-page-head"><h1>Ranking</h1></div>
  <div className="c-seg wide"><button className={view==='week'?'on':''} onClick={()=>setView('week')}>This week</button><button className={view==='season'?'on':''} onClick={()=>setView('season')}>Season</button></div>
  {view==='week'&&<>
   {visible.length>1&&<div className="c-weeks">{visible.slice(0,8).map((r,i)=><button key={r.id} className={r.id===board?.id?'on':''} onClick={()=>onSelect(r.id)}>{i===0&&['live','provisional','waiting_feed'].includes(r.state)?'This week':new Date(r.opens_at).toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</button>)}</div>}
   {!board?<div className="c-empty"><h2>No ranking yet</h2><p>The first week starts once three friends are in.</p></div>:board.state==='skipped'?<div className="c-empty"><h2>This week didn’t count</h2><p>{board.skip_reason||'Not enough of you played.'}</p></div>:<>
    {board.state==='final'&&board.winners.length>0&&<div className="c-winner"><span className="c-kicker dark">{board.winners.length>1?'Shared win':'Winner of the week'}</span><b>{board.winners.map(w=>w.user_id===me?'You':w.name).join(' & ')}</b><button className="c-chip dark" onClick={()=>onShareWinner(board)}><Icon name="share" size={16}/> Share</button></div>}
    <Podium rows={weekRows} me={me}/>
    {best&&<div className="c-cotw"><span className="c-cotw-icon"><Icon name="star" size={22}/></span><div><span>Call of the week</span><b>{best.name===meName?'You':best.name} on {label(best.answer)}{best.alone?', alone':''} · +{best.score}</b></div></div>}
    <p className="c-foot-note">{live?'Points land as results come in. Final ranking '+when(board.publish_at,clock,board.timezone)+'. Everyone starts fresh next week.':board.state==='final'?'Final.':''}</p>
   </>}
  </>}
  {view==='season'&&<>{seasonRows.length>0&&<Podium rows={seasonRows} me={me}/>}<SeasonsPanel seasons={seasons} userId={me} admin={admin} busy={busy} act={act} clock={clock}/></>}
 </>;
}
