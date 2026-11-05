'use client';
import {useState} from 'react';
import {Face,Icon} from './ui';
import {type Call,type Snapshot,label,potential,pts} from './calls';
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

/** The boldest right call since `from`: the one the fewest friends got right. */
export function boldestCall(calls:Call[],snaps:Snapshot[],from:number){
 let best:{name:string;answer:string;score:number;alone:boolean;text:string}|null=null;
 for(const c of calls){if(c.state!=='settled'||!c.result_answer||!c.settled_at||Date.parse(c.settled_at)<from)continue;const mine=snaps.filter(s=>s.question_id===c.id);const right=mine.filter(s=>s.answer===c.result_answer);
  for(const s of right){const score=potential(right.length,mine.length);if(!best||score>best.score)best={name:s.name,answer:label(c.result_answer,c),score,alone:right.length===1&&mine.length>1,text:c.text}}}
 return best;
}
type Standing={user_id:string;name:string;active:boolean;points_tenths:number;rank:number};
export type Boards={weekFrom:string;monthFrom:string;week:Standing[];month:Standing[];monthLabel:string;oracles:{month:string;winners:{user_id:string;name:string;points_tenths:number}[]}[];titles:Record<string,number>};
const monthOf=(key:string)=>new Date(key+'-15T12:00:00Z').toLocaleDateString('en-GB',{month:'long'});
const rowsOf=(list:Standing[]):Row[]=>list.map(s=>({user_id:s.user_id,name:s.name,active:s.active,points:pts(s.points_tenths),rank:s.rank}));

export default function RankingTab({boards,me,meName,calls,snaps,careers=[],names={},onProfile,onShareOracle}:{boards?:Boards;careers?:Career[];names?:Record<string,string>;onProfile?:(id:string)=>void;me?:string;meName?:string;calls:Call[];snaps:Snapshot[];onShareOracle:(names:string,month:string)=>void}){
 const [view,setView]=useState<'week'|'month'|'alltime'>('month');
 const titles=boards?.titles||{};
 const rows=rowsOf(view==='week'?boards?.week||[]:boards?.month||[]),any=rows.some(r=>r.points>0);
 const last=boards?.oracles[0];
 const best=boards?boldestCall(calls,snaps,Date.parse(view==='week'?boards.weekFrom:boards.monthFrom)):null;
 return <>
  <div className="c-page-head"><h1>Ranking</h1></div>
  <div className="c-seg wide three"><button className={view==='week'?'on':''} onClick={()=>setView('week')}>This week</button><button className={view==='month'?'on':''} onClick={()=>setView('month')}>This month</button><button className={view==='alltime'?'on':''} onClick={()=>setView('alltime')}>All time</button></div>
  {view!=='alltime'&&<>
   {view==='month'&&last&&<div className="c-winner"><span className="c-kicker dark">👑 {last.winners.length>1?'Oracles':'Oracle'} of {monthOf(last.month)}</span><b>{last.winners.map(w=>w.user_id===me?'You':w.name).join(' & ')}</b><button className="c-chip dark" onClick={()=>onShareOracle(last.winners.map(w=>w.name).join(' & '),monthOf(last.month))}><Icon name="share" size={16}/> Share</button></div>}
   {any?<Podium rows={rows} me={me} onProfile={onProfile}/>:<div className="c-empty"><h2>No points yet {view==='week'?'this week':'this month'}</h2><p>Points land when a call settles. Bold calls score more.</p></div>}
   {best&&<div className="c-cotw"><span className="c-cotw-icon"><Icon name="star" size={22}/></span><div><span>Boldest call {view==='week'?'this week':'this month'}</span><b>{best.name===meName?'You':best.name} on {best.answer}{best.alone?', alone':''} · +{best.score}</b></div></div>}
   <p className="c-foot-note">{view==='month'?'Whoever tops '+(boards?.monthLabel.split(' ')[0]||'the month')+' is the Oracle of the month. Everyone starts level on the 1st.':'Every point counts on the day its call settles.'}</p>
  </>}
  {view==='alltime'&&<AllTime careers={careers} names={names} titles={titles} me={me} onProfile={onProfile}/>}
  {view==='alltime'&&boards&&boards.oracles.length>0&&<div className="c-oracle-hall"><span className="c-label">Oracles of the month</span>{boards.oracles.map(o=><div key={o.month} className="c-oracle-hall-row"><span>{monthOf(o.month)} {o.month.slice(0,4)}</span><b>👑 {o.winners.map(w=>w.user_id===me?'You':w.name).join(' & ')}</b></div>)}</div>}
 </>;
}

/** Career points since the group started, with everyone's level. */
function AllTime({careers,names,titles,me,onProfile}:{careers:Career[];names:Record<string,string>;titles:Record<string,number>;me?:string;onProfile?:(id:string)=>void}){
 const rows=[...careers].filter(c=>names[c.user_id]).sort((a,b)=>b.points-a.points);
 if(!rows.length)return <div className="c-empty"><h2>No career points yet</h2><p>Every point you win adds up here, forever.</p></div>;
 return <><p className="c-hint" style={{margin:'0 4px 10px'}}>Career points since the group started. They only ever go up.</p>
  <div className="c-alltime">{rows.map((c,i)=><button key={c.user_id} className={'c-alltime-row'+(c.user_id===me?' me':'')} onClick={()=>onProfile?.(c.user_id)}>
   <span className="c-pos">{i+1}</span><LevelArt level={c.level.n} size={44}/>
   <span className="c-alltime-name"><b>{c.user_id===me?'You':names[c.user_id]}</b><small>L{c.level.n} · {c.level.name}{titles[c.user_id]?' · 👑 ×'+titles[c.user_id]:''}</small></span>
   <b className="c-alltime-pts">{c.points.toLocaleString('en-GB')}</b></button>)}</div>
  <p className="c-foot-note">All-time is for bragging. Every month starts level: a friend who joined yesterday can be this month’s Oracle.</p></>;
}
