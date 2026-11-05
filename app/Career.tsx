'use client';
import {Sheet,Icon} from './ui';
import LevelArt from './LevelArt';
import {BADGES} from '../lib/career';
import type {Career} from '../lib/career';

/** Badge medallion art (stroke icons on a coloured disc). Earned badges are bold, others are greyed out. */
const BADGE_ART:Record<string,{color:string;icon:string}>={
 houdini:{color:'#A98BFF',icon:'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.6-1.7 M12 15v2'},
 lone_wolf:{color:'#6FB7FF',icon:'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z M17 3l.8 1.7 1.7.8-1.7.8L17 8l-.8-1.7-1.7-.8 1.7-.8z'},
 derby:{color:'#FF8A5B',icon:'M7 9a5 5 0 1 1 10 0c0 3.5-3.5 4-3.5 7a2.5 2.5 0 0 1-5 0 M10 9a2 2 0 1 1 4 0 M20 6a8 8 0 0 1 0 7'},
 perfect_weekend:{color:'#4FD39A',icon:'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M9 15l2 2 4-4'},
 hat_trick:{color:'#D7F25A',icon:'M4 6l2 2 4-4 M4 12l2 2 4-4 M4 18l2 2 4-4 M14 6h6 M14 12h6 M14 18h6'},
 early_bird:{color:'#FFC145',icon:'M3 18h18 M7 18a5 5 0 0 1 10 0 M12 5v3 M5 10l2 2 M19 10l-2 2'},
 crowd:{color:'#FF7EB6',icon:'M12 20V4 M6 10l6-6 6 6 M3 16h5 M16 16h5'},
 rock_solid:{color:'#7FD6E8',icon:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4'},
 ritual_maker:{color:'#B9A2FF',icon:'M4 10h16v10H4z M12 10v10 M4 14h16 M12 10c-2-4-6-4-6-1s6 1 6 1c0 0 6 2 6-1s-4-3-6 1'},
 moment_oracle:{color:'#FFC94D',icon:'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v1a3 3 0 0 0 3 3 M17 6h3v1a3 3 0 0 1-3 3'},
};
export function BadgeMedal({id,earned,size=56}:{id:string;earned:boolean;size?:number}){
 const a=BADGE_ART[id];return <span className={'c-medal'+(earned?' on':'')} style={{width:size,height:size,background:earned?a.color:undefined}} aria-hidden="true"><svg width={size*0.56} height={size*0.56} viewBox="0 0 24 24" fill="none" stroke={earned?'#17201B':'#9AA096'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={a.icon}/></svg></span>;
}

/** Small "L7 Oracle · 1,240" pill with the level character. */
export function LevelPill({c,onClick,dark=false}:{c:Career;onClick?:()=>void;dark?:boolean}){
 const inner=<><span className="c-pill-art"><LevelArt level={c.level.n} size={26}/></span>L{c.level.n} {c.level.name} · {c.points.toLocaleString('en-GB')}</>;
 return onClick?<button className={'c-level-pill'+(dark?' dark':'')} onClick={onClick} aria-label={'Your career: level '+c.level.n+' '+c.level.name+', '+c.points+' career points'}>{inner}</button>:<span className={'c-level-pill'+(dark?' dark':'')}>{inner}</span>;
}

/** A player's profile: level character, career points, streaks and badges. */
export function ProfileSheet({c,name,me,onClose}:{c:Career|null;name:string;me:boolean;onClose:()=>void}){
 if(!c)return null;const l=c.level;
 return <Sheet open label={name+'’s career'} onClose={onClose} full>
  <div className="c-profile-hero">
   <LevelArt level={l.n} size={132}/>
   <div className="c-profile-id"><b>{me?'You':name}</b><span className="c-level-chip">Level {l.n} · {l.name}</span></div>
   <span className="c-career-points">{c.points.toLocaleString('en-GB')}</span>
   <span className="c-career-sub">career points · only ever go up</span>
   {l.next?<div className="c-career-progress"><div className="c-bar"><i style={{width:Math.max(3,Math.round(l.progress*100))+'%'}}/></div><span>{l.next.toGo.toLocaleString('en-GB')} to {l.next.name}</span></div>:<span className="c-career-sub">Top level. Nothing gets past {me?'you':name}.</span>}
  </div>
  <div className="c-stats">
   <div><Icon name="crown" size={20}/><b>{c.weeklyWins}</b><span>weekly {c.weeklyWins===1?'win':'wins'}</span></div>
   <div><Icon name="star" size={20}/><b>{c.top3Streak}</b><span>{c.top3Streak===1?'week':'weeks'} in a row in the top 3</span></div>
   <div><Icon name="check" size={20}/><b>{c.earned}/{BADGES.length}</b><span>badges</span></div>
  </div>
  <span className="c-label">Badges</span>
  <div className="c-badges">{BADGES.map(b=>{const n=c.badges[b.id];return <div key={b.id} className={'c-badge-card'+(n?' on':'')}><div className="c-badge-top"><BadgeMedal id={b.id} earned={!!n}/><span className="c-badge-count">{n?'×'+n:'Not yet'}</span></div><b>{b.name}</b><small>{b.rule}</small></div>})}</div>
  {c.history.length>0&&<><span className="c-label">Where it came from</span><div className="c-history">{c.history.map(h=><div key={h.opens_at}><span>{new Date(h.opens_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · {h.rank===1?(h.final?'won the week':'1st so far'):ordinal(h.rank)+(h.final?'':' so far')}</span><b>+{h.points}</b></div>)}</div></>}
  <p className="c-hint">Career points are the points {me?'you’ve':name+' has'} won, added up forever. They’re never put on a call, so they can’t go down, and they can’t be spent, sent or swapped. Every week still starts with a fresh 100.</p>
 </Sheet>;
}
const ordinal=(n:number)=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');

/** Shown once, right after a result pushes you up a level. */
export function LevelUpSheet({c,from,onClose,onShare}:{c:Career|null;from:string;onClose:()=>void;onShare:()=>void}){
 if(!c)return null;
 return <Sheet open dark full label="Level up" onClose={onClose}><div className="c-levelup">
  <span className="c-kicker">Level up</span>
  <LevelArt level={c.level.n} size={180}/>
  <h2 className="c-huge light">{c.level.name}</h2>
  <p className="c-sub light">You saw it coming. {from} → {c.level.name}</p>
  {c.level.next&&<p className="c-sub light">{c.points.toLocaleString('en-GB')} career points · {c.level.next.toGo.toLocaleString('en-GB')} to {c.level.next.name}</p>}
  <button className="c-btn" onClick={onShare}><Icon name="share"/> Tell the group</button>
  <button className="c-link light" onClick={onClose}>Back to calls</button>
 </div></Sheet>;
}
