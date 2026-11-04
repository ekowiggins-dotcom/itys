'use client';
import {useState} from 'react';
import {Face,Icon} from './ui';
import type {WeeklyRound} from './rounds-types';
import SeasonsPanel,{type SeasonView} from './SeasonsPanel';
import {type Call,type Snapshot,label,potential,pts} from './calls';
import {when} from './format';
import LevelArt from './LevelArt';
import type {Career} from '../lib/career';

type Row={user_id:string;name:string;active:boolean;points:number;rank:number};
/** Top three on a podium, everyone else in a list. Whole points only. */
export function Podium({rows,me,onProfile}:{rows:Row[];me?:string;onProfile?:(id:string)=>void}){
 if(!rows.length)return null;
 const [first,second,third]=rows,rest=rows.slice(3);
 const step=(r:Row|undefined,place:1|2|3)=>r?<div className={'c-step p'+place} onClick={()=>onProfile?.(r.user_id)} role={onProfile?'button':undefined} tabIndex={onProfile?0:undefined}>{place===1&&<Icon name="crown" size={28}/>}<Face name={r.name} size={place===1?64:52} ring="#17201B"/><span className="c-step-name">{r.user_id===me?'You':r.name}</span><div className="c-block"><b>{r.points}</b><small>{['1st','2nd','3rd'][place-1]}</small></div></div>:<div className={'c-step p'+place+' empty'}/>;
 return <><div className="c-podium">{step(second,2)}{step(first,1)}{step(third,3)}</div>
  {rest.length>0&&<div className="c-table">{rest.map(r=><div key={r.user_id} className={'c-table-row'+(r.user_id===me?' me':'')} onClick={()=>onProfile?.(r.user_id)} role={onProfile?'button':undefined} tabIndex={onProfile?0:undefined}><span className="c-pos">{r.rank}</span><Face name={r.name} size={32}/><span className="c-table-name">{r.user_id===me?'You':r.name}{!r.active&&<small> · left</small>}</span><b>{r.points}</b></div>)}</div>}</>;
}

/** The boldest right call this week, worked out from the reveal snapshots. */
export function callOfTheWeek(calls:Call[],snaps:Snapshot[]){
 let best:{name:string;answer:string;score:number;alone:boolean;text:string}|null=null;
 for(const c of calls){if(c.state!=='settled'||c.scope!=='weekly'||!c.result_answer)continue;const mine=snaps.filter(s=>s.question_id===c.id);const right=mine.filter(s=>s.answer===c.result_answer);
  for(const s of right){const score=potential(s.stake,right.length,mine.length);if(!best||score>best.score)best={name:s.name,answer:c.result_answer,score,alone:right.length===1&&mine.length>1,text:c.text}}}
 return best;
}

export default function RankingTab({rounds,board,onSelect,me,meName,calls,snaps,seasons,admin,busy,act,clock,onShareWinner,careers=[],names={},onProfile}:{careers?:Career[];names?:Record<string,string>;onProfile?:(id:string)=>void;rounds:WeeklyRound[];board?:WeeklyRound;onSelect:(id:string)=>void;me?:string;meName?:string;calls:Call[];snaps:Snapshot[];seasons:SeasonView[];admin:boolean;busy:boolean;act:(p:Record<string,unknown>)=>Promise<boolean>;clock:number;onShareWinner:(r:WeeklyRound)=>void}){
 const [view,setView]=useState<'week'|'season'|'alltime'>('week');
 const season=seasons.find(s=>s.state==='active')||seasons[0];
 const weekRows:Row[]=(board?.standings||[]).map(s=>({user_id:s.user_id,name:s.name,active:s.active,points:pts(s.points_tenths),rank:s.rank}));
 const seasonRows:Row[]=(season?.standings||[]).map(s=>({user_id:s.user_id,name:s.name,active:s.active,points:pts(s.totalTenths),rank:s.rank}));
 const best=board&&calls.some(c=>c.round_id===board.id)?callOfTheWeek(calls.filter(c=>c.round_id===board.id),snaps):null;
 const live=board&&['live','provisional','waiting_feed'].includes(board.state);
 const visible=rounds.filter(r=>r.state!=='planned');
 return <>
  <div className="c-page-head"><h1>Ranking</h1></div>
  <div className="c-seg wide three"><button className={view==='week'?'on':''} onClick={()=>setView('week')}>This week</button><button className={view==='season'?'on':''} onClick={()=>setView('season')}>Season</button><button className={view==='alltime'?'on':''} onClick={()=>setView('alltime')}>All-time</button></div>
  {view==='week'&&<>
   {visible.length>1&&<div className="c-weeks">{visible.slice(0,8).map((r,i)=><button key={r.id} className={r.id===board?.id?'on':''} onClick={()=>onSelect(r.id)}>{i===0&&['live','provisional','waiting_feed'].includes(r.state)?'This week':new Date(r.opens_at).toLocaleDateString('en-GB',{month:'short',day:'numeric'})}</button>)}</div>}
   {!board?<div className="c-empty"><h2>No ranking yet</h2><p>The first week starts once three friends are in.</p></div>:board.state==='skipped'?<div className="c-empty"><h2>This week didn’t count</h2><p>{board.skip_reason||'Not enough of you played.'}</p></div>:<>
    {board.state==='final'&&board.winners.length>0&&<div className="c-winner"><span className="c-kicker dark">{board.winners.length>1?'Shared win':'Winner of the week'}</span><b>{board.winners.map(w=>w.user_id===me?'You':w.name).join(' & ')}</b><button className="c-chip dark" onClick={()=>onShareWinner(board)}><Icon name="share" size={16}/> Share</button></div>}
    <Podium rows={weekRows} me={me} onProfile={onProfile}/>
    {best&&<div className="c-cotw"><span className="c-cotw-icon"><Icon name="star" size={22}/></span><div><span>Call of the week</span><b>{best.name===meName?'You':best.name} on {label(best.answer)}{best.alone?', alone':''} · +{best.score}</b></div></div>}
    <p className="c-foot-note">{live?'Points land as results come in. Final ranking '+when(board.publish_at,clock,board.timezone)+'. Everyone starts fresh next week.':board.state==='final'?'Final.':''}</p>
   </>}
  </>}
  {view==='alltime'&&<AllTime careers={careers} names={names} me={me} onProfile={onProfile}/>}
  {view==='season'&&<>{seasonRows.length>0&&<Podium rows={seasonRows} me={me}/>}<SeasonsPanel seasons={seasons} userId={me} admin={admin} busy={busy} act={act} clock={clock}/></>}
 </>;
}

/** Career points since the group started, with everyone's level. */
function AllTime({careers,names,me,onProfile}:{careers:Career[];names:Record<string,string>;me?:string;onProfile?:(id:string)=>void}){
 const rows=[...careers].filter(c=>names[c.user_id]).sort((a,b)=>b.points-a.points);
 if(!rows.length)return <div className="c-empty"><h2>No career points yet</h2><p>Win points in any week and they add up here, forever.</p></div>;
 return <><p className="c-hint" style={{margin:'0 4px 10px'}}>Career points since the group started. They only ever go up.</p>
  <div className="c-alltime">{rows.map((c,i)=><button key={c.user_id} className={'c-alltime-row'+(c.user_id===me?' me':'')} onClick={()=>onProfile?.(c.user_id)}>
   <span className="c-pos">{i+1}</span><LevelArt level={c.level.n} size={44}/>
   <span className="c-alltime-name"><b>{c.user_id===me?'You':names[c.user_id]}</b><small>L{c.level.n} · {c.level.name}</small></span>
   <b className="c-alltime-pts">{c.points.toLocaleString('en-GB')}</b></button>)}</div>
  <p className="c-foot-note">All-time is for bragging. Every week still starts level: a friend who joined yesterday can win this week.</p></>;
}
