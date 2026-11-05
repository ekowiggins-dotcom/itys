'use client';
// Moments: a birthday, a trip, a night out. A few calls that close together, one table, one card at the end.
import {useEffect,useMemo,useState} from 'react';
import {Sheet,Face,Faces,Icon,Badge,Split} from './ui';
import {type Call,type Moment,type Snapshot,answersOf,label,momentView,momentLeaders} from './calls';
import {countdown,when} from './format';
import {starters,MOMENT_KINDS,type MomentKind} from '../lib/moment-starters';

type Lang='tr'|'en';
export const KIND:Record<MomentKind,{emoji:string;en:string;tr:string;who?:'friend';place?:true;titled?:true}>={
 birthday:{emoji:'🎂',en:'Birthday',tr:'Doğum günü',who:'friend'},
 trip:{emoji:'✈️',en:'Trip',tr:'Tatil',place:true},
 wedding:{emoji:'💍',en:'Wedding',tr:'Düğün',who:'friend'},
 night:{emoji:'🎉',en:'Night out',tr:'Gece',titled:true},
 baby:{emoji:'👶',en:'Baby',tr:'Bebek',who:'friend'},
 job:{emoji:'💼',en:'New job / exams',tr:'Yeni iş / sınav',who:'friend'},
 own:{emoji:'✏️',en:'Your own',tr:'Kendin yaz',titled:true},
};
function autoTitle(kind:MomentKind,lang:Lang,who:string,place:string,typed:string){
 const k=KIND[kind];if(k.titled)return typed;if(k.place)return place?(lang==='tr'?'Tatil: ':'Trip: ')+place:'';
 return who?(lang==='tr'?k.tr+': ':k.en+': ')+who:'';
}
/** Tomorrow at 20:00 local, as a datetime-local value. */
function defaultStart(now:number){const d=new Date(now+86400000);d.setHours(20,0,0,0);const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T20:00`}

type Draft={text:string;answerType:'friend'|'choice';options?:string[];on:boolean};
export type NewMoment={kind:MomentKind;title:string;subject?:string;startsAt:string;calls:{text:string;answerType:'friend'|'choice';options?:string[]}[]};

/** Start a Moment: the occasion, one or two details, three suggested calls. */
export function NewMomentSheet({open,now,lang,friends,busy,onCreate,onClose}:{open:boolean;now:number;lang:Lang;friends:string[];busy:boolean;onCreate:(m:NewMoment)=>Promise<boolean>;onClose:()=>void}){
 const [kind,setKind]=useState<MomentKind|null>(null),[who,setWho]=useState(''),[place,setPlace]=useState(''),[typed,setTyped]=useState(''),[start,setStart]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[extra,setExtra]=useState('');
 useEffect(()=>{if(open){setKind(null);setWho('');setPlace('');setTyped('');setStart(defaultStart(now));setDrafts([]);setExtra('')}},[open]);
 useEffect(()=>{if(kind)setDrafts(starters(kind,lang,who).map(s=>({...s,on:true})))},[kind,who,lang]);
 if(!open)return null;
 const k=kind?KIND[kind]:null,title=kind?autoTitle(kind,lang,who,place,typed):'';
 const chosen=drafts.filter(d=>d.on&&d.text.trim().length>=3);
 const startMs=start?new Date(start).getTime():0,needsFriends=chosen.some(d=>d.answerType==='friend')&&friends.length<2;
 const valid=!!kind&&title.trim().length>=2&&(!k?.who||!!who)&&startMs>now+10*60000&&chosen.length>0&&!needsFriends;
 return <Sheet open label="New Moment" onClose={onClose} full>
  <span className="c-kicker dark">New Moment</span>
  <h2 className="c-title">What’s the occasion?</h2>
  <div className="c-kinds">{MOMENT_KINDS.map(id=><button key={id} type="button" className={kind===id?'on':''} aria-pressed={kind===id} onClick={()=>setKind(id)}><span className="c-kind-emoji" aria-hidden="true">{KIND[id].emoji}</span>{KIND[id].en}</button>)}</div>
  {k&&<>
   {k.who&&<><span className="c-label">{kind==='birthday'?'Whose birthday?':kind==='wedding'?'Whose wedding?':kind==='baby'?'Whose baby?':'Who’s starting?'}</span><div className="c-about">{friends.map(n=><button type="button" key={n} className={who===n?'on':''} aria-pressed={who===n} onClick={()=>setWho(n)}><Face name={n} size={26}/>{n}</button>)}</div></>}
   {k.place&&<label className="c-field">Where to?<input className="c-input" value={place} onChange={e=>setPlace(e.target.value)} maxLength={40} placeholder={lang==='tr'?'Kaş, Roma, kamp…':'Rome, the coast, camping…'}/></label>}
   {k.titled&&<label className="c-field">Call it<input className="c-input" value={typed} onChange={e=>setTyped(e.target.value)} maxLength={60} placeholder={kind==='night'?(lang==='tr'?'Cumartesi gecesi':'Saturday night'):(lang==='tr'?'Cem’in bekarlığa vedası':'Cem’s stag do')}/></label>}
   <label className="c-field">When does it start?<input className="c-input" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/><small>Picks close then.</small></label>
   <span className="c-label">Calls <small>Keep, edit or untick. Up to 8.</small></span>
   <div className="c-drafts">{drafts.map((d,i)=><div key={i} className={'c-draft'+(d.on?'':' off')}>
    <button type="button" className="c-tick" aria-pressed={d.on} aria-label={d.on?'Remove this call':'Keep this call'} onClick={()=>setDrafts(drafts.map((x,j)=>j===i?{...x,on:!x.on}:x))}>{d.on&&<Icon name="check" size={16} stroke={3}/>}</button>
    <div className="c-draft-main"><textarea rows={2} maxLength={240} value={d.text} onChange={e=>setDrafts(drafts.map((x,j)=>j===i?{...x,text:e.target.value}:x))} aria-label={'Call '+(i+1)}/>
     <small>{d.answerType==='friend'?'Pick a friend':d.options?.length?d.options.join(' · '):'Yes / No'}</small></div></div>)}
    {drafts.length<8&&<div className="c-draft add"><input className="c-input" value={extra} onChange={e=>setExtra(e.target.value)} maxLength={240} placeholder="+ Add your own (a “who…?” question picks a friend)"/>
     <button type="button" className="c-btn small" disabled={extra.trim().length<3} onClick={()=>{const q=extra.trim();const friend=/^(who|kim)\b|\bkim\b/i.test(q)&&friends.length>=2;setDrafts([...drafts,{text:q,answerType:friend?'friend':'choice',on:true}]);setExtra('')}}>Add</button></div>}
   </div>
   {needsFriends&&<p className="c-hint warn">Add friends in the Group tab first, for “who…?” calls.</p>}
   <div className="c-sheet-foot"><span className="c-badge later">{title||'…'}{startMs?' · '+when(new Date(startMs).toISOString(),now):''}</span>
    <button className="c-btn" disabled={!valid||busy} onClick={async()=>{if(await onCreate({kind:kind!,title:title.trim(),subject:who||undefined,startsAt:new Date(startMs).toISOString(),calls:chosen.slice(0,8).map(d=>({text:d.text.trim(),answerType:d.answerType,options:d.options}))}))onClose()}}>Create & share <Icon name="arrow"/></button></div>
  </>}
 </Sheet>;
}

/** The Moment at the top of the Calls tab. */
export function MomentCard({m,calls,me,names,now,lang,onOpen,onPick}:{m:Moment;calls:Call[];me?:string;names:Record<string,string>;now:number;lang:Lang;onOpen:()=>void;onPick:()=>void}){
 const v=momentView(m,calls,now,me),k=KIND[m.kind as MomentKind]||KIND.own;
 const pickers=[...new Set(v.calls.flatMap(c=>c.picker_ids||[]))].map(id=>names[id]).filter(Boolean);
 return <article className={'c-moment '+v.status} onClick={onOpen}>
  <div className="c-moment-top"><span className="c-moment-emoji" aria-hidden="true">{k.emoji}</span><Badge tone={v.status==='open'?(Date.parse(m.starts_at)-now<6*3600000?'soon':'neutral'):'later'}>{v.status==='open'?(Date.parse(m.starts_at)-now<6*3600000?'Starts in '+countdown(m.starts_at,now):when(m.starts_at,now)):v.status==='live'?'Happening now':'All settled'}</Badge></div>
  <h3>{m.title}</h3>
  <p>{v.calls.length} {v.calls.length===1?'call':'calls'}{pickers.length?' · '+pickers.length+' in':''}{v.status==='live'&&v.settled?' · '+v.settled+' settled':''}</p>
  <div className="c-moment-foot"><Faces names={pickers} size={24}/>{v.status==='open'&&v.toPick.length>0?<button className="c-btn small" onClick={e=>{e.stopPropagation();onPick()}}>{v.toPick.length===v.calls.length?'Make your picks':v.toPick.length+' left to pick'}</button>:<span className="c-link">{v.status==='done'?'See who called it':'Open'} <Icon name="arrow" size={16}/></span>}</div>
 </article>;
}

/** A Moment's own page: its calls, the table, the result. */
export function MomentSheet({m,calls,snaps,me,meName,names,now,lang,onClose,onPick,onReveal,onResolve,onResult,onShare,canSet}:{m:Moment|null;calls:Call[];snaps:Snapshot[];me?:string;meName?:string;names:Record<string,string>;now:number;lang:Lang;onClose:()=>void;onPick:(c?:Call)=>void;onReveal:(c:Call)=>void;onResolve:(c:Call)=>void;onResult:(c:Call)=>void;onShare:()=>void;canSet:(c:Call)=>boolean}){
 const v=useMemo(()=>m?momentView(m,calls,now,me):null,[m,calls,now,me]);
 const leaders=useMemo(()=>v?momentLeaders(v.calls,snaps):[],[v,snaps]);
 if(!m||!v)return null;
 const k=KIND[m.kind as MomentKind]||KIND.own,top=leaders[0],tied=top?leaders.filter(l=>l.points===top.points&&l.right===top.right):[];
 const kindName=(m.kind==='own'?'moment':m.kind==='job'?'new start':k.en).toLowerCase();
 return <Sheet open label={m.title} onClose={onClose} full>
  <div className="c-moment-head"><span className="c-moment-emoji big" aria-hidden="true">{k.emoji}</span><div><span className="c-kicker dark">{v.status==='open'?'Picks close '+when(m.starts_at,now):v.status==='live'?'Happening now':'All settled'}</span><h2 className="c-title">{m.title}</h2></div></div>
  {v.status==='open'&&v.toPick.length>0&&<button className="c-btn" onClick={()=>onPick()}>{v.toPick.length===v.calls.length?'Make your picks':'Pick the last '+v.toPick.length} <Icon name="arrow"/></button>}
  {top&&<section className={'c-oracle'+(v.status==='done'?' done':'')}><span className="c-kicker dark">{v.status==='done'?'Oracle of the '+kindName:'Leading so far'}</span>
   <div className="c-oracle-who"><Faces names={tied.map(t=>t.name)} size={44} ring="#17201B"/><b>{tied.map(t=>t.name===meName?'You':t.name).join(' & ')}</b><span>{top.right} of {v.settled} right</span></div>
   {leaders.length>1&&<ol className="c-oracle-list">{leaders.slice(0,6).map(l=><li key={l.name}><Face name={l.name} size={22}/>{l.name===meName?'You':l.name}<span className="c-n">{l.right}/{v.settled}</span></li>)}</ol>}
  </section>}
  <div className="c-moment-calls">{v.calls.map((c,i)=>{const open=c.state==='open'&&now<Date.parse(c.locks_at),settled=c.state==='settled',isVoid=c.state==='void';
   return <div key={c.id} className="c-mcall">
    <span className="c-mcall-n">{i+1}</span>
    <div className="c-mcall-main"><b>{c.text}</b>
     {settled?<small className={c.answer&&c.answer===c.result_answer?'win':''}>{label(c.result_answer||'',c)} it was{c.answer?' · you said '+label(c.answer,c):''}</small>
     :isVoid?<small>Called off</small>
     :c.answer?<small>You said {label(c.answer,c)}</small>:<small>{open?'Not picked yet':'You didn’t pick'}</small>}
     {c.split&&!settled&&<Split answers={answersOf(c)} counts={c.split} mine={c.answer} label={a=>label(a,c)} compact/>}
    </div>
    <div className="c-mcall-act">{open?<button className="c-chip" onClick={()=>onPick(c)}>{c.answer?'Change':'Pick'}</button>
     :settled?<button className="c-chip" onClick={()=>onResult(c)}>See</button>
     :c.state==='open'&&canSet(c)?<button className="c-chip dark" onClick={()=>onResolve(c)}>What happened?</button>
     :!isVoid?<button className="c-chip" onClick={()=>onReveal(c)}>Who said what</button>:null}</div>
   </div>})}</div>
  <button className="c-btn ghost" onClick={onShare}><Icon name="share"/> {v.status==='done'?'Share the result':'Send to the group'}</button>
 </Sheet>;
}

/** Group tab: the group's Moments so far. Its shared memory. */
export function PastMoments({moments,calls,snaps,now,meName,onOpen}:{moments:Moment[];calls:Call[];snaps:Snapshot[];now:number;meName?:string;onOpen:(m:Moment)=>void}){
 const past=moments.filter(m=>momentView(m,calls,now).status==='done');
 if(!past.length)return null;
 return <section className="c-card past"><span className="c-kicker dark">Past Moments</span><div className="c-past">{past.map(m=>{const v=momentView(m,calls,now),l=momentLeaders(v.calls,snaps),top=l[0];const k=KIND[m.kind as MomentKind]||KIND.own;
  return <button key={m.id} className="c-past-row" onClick={()=>onOpen(m)}><span className="c-moment-emoji" aria-hidden="true">{k.emoji}</span><span className="c-past-main"><b>{m.title}</b><small>{new Date(m.starts_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}{top?' · '+(top.name===meName?'You':top.name)+' called '+top.right+'/'+v.settled:''}</small></span><Icon name="arrow" size={16}/></button>})}</div></section>;
}
