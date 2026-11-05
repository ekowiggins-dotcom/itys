'use client';
// Moments: a birthday, a trip, a night out. A few calls that close together, one table, one card at the end.
import {useEffect,useMemo,useState} from 'react';
import {Sheet,Face,Faces,Icon,Badge,Split} from './ui';
import {type Call,type Moment,type Snapshot,answersOf,label,momentView,momentLeaders,reveal} from './calls';
import {countdown,when} from './format';
import {starters,MOMENT_KINDS,type MomentKind} from '../lib/moment-starters';
import {eventByKey,type EventDef} from '../lib/events';
/** A Moment's emoji: its event's, or its occasion's. */
export const momentEmoji=(m:{kind:string;event_key?:string|null})=>eventByKey(m.event_key)?.emoji||(KIND as Record<string,{emoji:string}>)[m.kind]?.emoji||'✨';

type Lang='tr'|'en';
export const KIND:Record<MomentKind,{emoji:string;en:string;tr:string;who?:'friend';place?:true;titled?:true;year?:true}>={
 year:{emoji:'🔮',en:'Year ahead',tr:'Yeni yıl',year:true},
 birthday:{emoji:'🎂',en:'Birthday',tr:'Doğum günü',who:'friend'},
 trip:{emoji:'✈️',en:'Trip',tr:'Tatil',place:true},
 wedding:{emoji:'💍',en:'Wedding',tr:'Düğün',who:'friend'},
 night:{emoji:'🎉',en:'Night out',tr:'Gece',titled:true},
 baby:{emoji:'👶',en:'Baby',tr:'Bebek',who:'friend'},
 job:{emoji:'💼',en:'New job / exams',tr:'Yeni iş / sınav',who:'friend'},
 own:{emoji:'✏️',en:'Your own',tr:'Kendin yaz',titled:true},
 event:{emoji:'📅',en:'Event',tr:'Etkinlik',titled:true},
};
function autoTitle(kind:MomentKind,lang:Lang,who:string,place:string,typed:string){
 const k=KIND[kind];if(k.year){const y=new Date().getMonth()>=9?new Date().getFullYear()+1:new Date().getFullYear();return lang==='tr'?y+' kehanetleri':'Predictions for '+y}if(k.titled)return typed;if(k.place)return place?(lang==='tr'?'Tatil: ':'Trip: ')+place:'';
 return who?(lang==='tr'?k.tr+': ':k.en+': ')+who:'';
}
const local=(d:Date)=>{const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
/** New Year: seal on New Year's Eve, open on the next one. */
function yearDates(now:number){const d=new Date(now),y=d.getMonth()>=9?d.getFullYear():d.getFullYear()-1;return{seal:local(new Date(y,11,31,23,0)),open:local(new Date(y+1,11,31,23,0))}}
/** Tomorrow at 20:00 local, as a datetime-local value. */
function defaultStart(now:number){const d=new Date(now+86400000);d.setHours(20,0,0,0);const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T20:00`}

type Draft={text:string;answerType:'friend'|'choice';options?:string[];on:boolean};
export type NewMoment={kind:MomentKind;title:string;subject?:string;startsAt:string;sealed?:boolean;opensAt?:string;eventKey?:string;calls:{text:string;answerType:'friend'|'choice';options?:string[]}[]};

/** Start a Moment: the occasion, one or two details, three suggested calls. */
export function NewMomentSheet({open,now,lang,friends,busy,preset,presetEvent,events=[],onCreate,onClose}:{open:boolean;now:number;lang:Lang;friends:string[];busy:boolean;preset?:MomentKind;presetEvent?:string;events?:EventDef[];onCreate:(m:NewMoment)=>Promise<boolean>;onClose:()=>void}){
 const [sealed,setSealed]=useState(false),[opensOn,setOpensOn]=useState(''),[eventKey,setEventKey]=useState('');
 const [kind,setKind]=useState<MomentKind|null>(null),[who,setWho]=useState(''),[place,setPlace]=useState(''),[typed,setTyped]=useState(''),[start,setStart]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[extra,setExtra]=useState('');
 useEffect(()=>{if(open){setKind(preset||null);setWho('');setPlace('');setTyped('');setStart(defaultStart(now));setDrafts([]);setExtra('');setSealed(false);setOpensOn('');setEventKey('');const e=presetEvent?eventByKey(presetEvent):null;if(e)pickEvent(e)}},[open]);
 /** A calendar event: its name, date and suggested calls, all editable. */
 function pickEvent(e:EventDef){setEventKey(e.key);setKind('event');setTyped(lang==='tr'?e.tr:e.en);setStart(local(new Date(e.starts)));setDrafts(e.calls[lang].map(c=>({...c,on:true})));if(e.sealed){setSealed(true);setOpensOn(local(new Date(e.sealed.opens)))}else{setSealed(false);setOpensOn('')}}
 // The year ahead is sealed by default: seal on New Year's Eve, open on the next one. A birthday can be sealed until the next birthday.
 useEffect(()=>{if(kind==='year'){const d=yearDates(now);setSealed(true);setStart(d.seal);setOpensOn(d.open)}else if(sealed&&!opensOn&&start){setOpensOn(local(new Date(new Date(start).getTime()+365*86400000)))}},[kind]);
 useEffect(()=>{if(kind&&kind!=='event')setDrafts(starters(kind,lang,who).map(s=>({...s,on:true})))},[kind,who,lang]);
 if(!open)return null;
 const k=kind?KIND[kind]:null,title=kind?autoTitle(kind,lang,who,place,typed):'';
 const chosen=drafts.filter(d=>d.on&&d.text.trim().length>=3);
 const startMs=start?new Date(start).getTime():0,needsFriends=chosen.some(d=>d.answerType==='friend')&&friends.length<2;
 const opensMs=sealed&&opensOn?new Date(opensOn).getTime():0;
 const valid=!!kind&&title.trim().length>=2&&(!k?.who||!!who)&&startMs>now+10*60000&&chosen.length>0&&!needsFriends&&(!sealed||opensMs>=startMs+86400000);
 return <Sheet open label="New Moment" onClose={onClose} full>
  <span className="c-kicker dark">New Moment</span>
  <h2 className="c-title">What’s the occasion?</h2>
  {events.length>0&&<><span className="c-label">Coming up</span><div className="c-events">{events.map(e=><button key={e.key} type="button" className={eventKey===e.key?'on':''} aria-pressed={eventKey===e.key} onClick={()=>pickEvent(e)}><span aria-hidden="true">{e.emoji}</span><b>{lang==='tr'?e.tr:e.en}</b><small>{new Date(e.starts).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></button>)}</div><span className="c-label">Or your own occasion</span></>}
  <div className="c-kinds">{MOMENT_KINDS.filter(id=>id!=='event').map(id=><button key={id} type="button" className={kind===id&&!eventKey?'on':''} aria-pressed={kind===id} onClick={()=>{setEventKey('');setKind(id)}}><span className="c-kind-emoji" aria-hidden="true">{KIND[id].emoji}</span>{KIND[id].en}</button>)}</div>
  {k&&<>
   {k.who&&<><span className="c-label">{kind==='birthday'?'Whose birthday?':kind==='wedding'?'Whose wedding?':kind==='baby'?'Whose baby?':'Who’s starting?'}</span><div className="c-about">{friends.map(n=><button type="button" key={n} className={who===n?'on':''} aria-pressed={who===n} onClick={()=>setWho(n)}><Face name={n} size={26}/>{n}</button>)}</div></>}
   {k.place&&<label className="c-field">Where to?<input className="c-input" value={place} onChange={e=>setPlace(e.target.value)} maxLength={40} placeholder={lang==='tr'?'Kaş, Roma, kamp…':'Rome, the coast, camping…'}/></label>}
   {k.titled&&<label className="c-field">Call it<input className="c-input" value={typed} onChange={e=>setTyped(e.target.value)} maxLength={60} placeholder={kind==='night'?(lang==='tr'?'Cumartesi gecesi':'Saturday night'):(lang==='tr'?'Cem’in bekarlığa vedası':'Cem’s stag do')}/></label>}
   <label className="c-check c-seal"><input type="checkbox" checked={sealed} onChange={e=>{setSealed(e.target.checked);if(e.target.checked&&!opensOn&&start)setOpensOn(local(new Date(new Date(start).getTime()+365*86400000)))}}/><span><b>🔒 Seal it</b><small>Nobody sees any answers, not even the split, until the opening date. Then you open them together. Anyone can add predictions until it’s sealed.</small></span></label>
   <label className="c-field">{sealed?'Seal date':'When does it start?'}<input className="c-input" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/><small>{sealed?'Picks and new predictions close then.':'Picks close then.'}</small></label>
   {sealed&&<label className="c-field">Opens on<input className="c-input" type="datetime-local" value={opensOn} onChange={e=>setOpensOn(e.target.value)}/><small>Everyone gets the same push, and you open them one by one.</small></label>}
   <span className="c-label">Calls <small>Keep, edit or untick. Up to 8.</small></span>
   <div className="c-drafts">{drafts.map((d,i)=><div key={i} className={'c-draft'+(d.on?'':' off')}>
    <button type="button" className="c-tick" aria-pressed={d.on} aria-label={d.on?'Remove this call':'Keep this call'} onClick={()=>setDrafts(drafts.map((x,j)=>j===i?{...x,on:!x.on}:x))}>{d.on&&<Icon name="check" size={16} stroke={3}/>}</button>
    <div className="c-draft-main"><textarea rows={2} maxLength={240} value={d.text} onChange={e=>setDrafts(drafts.map((x,j)=>j===i?{...x,text:e.target.value}:x))} aria-label={'Call '+(i+1)}/>
     <small>{d.answerType==='friend'?'Pick a friend':d.options?.length?d.options.join(' · '):'Yes / No'}</small></div></div>)}
    {drafts.length<8&&<div className="c-draft add"><input className="c-input" value={extra} onChange={e=>setExtra(e.target.value)} maxLength={240} placeholder="+ Add your own (a “who…?” question picks a friend)"/>
     <button type="button" className="c-btn small" disabled={extra.trim().length<3} onClick={()=>{const q=extra.trim();const friend=/^(who|kim)\b|\bkim\b/i.test(q)&&friends.length>=2;setDrafts([...drafts,{text:q,answerType:friend?'friend':'choice',on:true}]);setExtra('')}}>Add</button></div>}
   </div>
   {needsFriends&&<p className="c-hint warn">Add friends in the Group tab first, for “who…?” calls.</p>}
   <div className="c-sheet-foot"><span className="c-badge later">{title||'…'}{sealed&&opensMs?' · opens '+new Date(opensMs).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):startMs?' · '+when(new Date(startMs).toISOString(),now):''}</span>
    <button className="c-btn" disabled={!valid||busy} onClick={async()=>{if(await onCreate({kind:kind!,title:title.trim(),subject:who||undefined,startsAt:new Date(startMs).toISOString(),sealed:sealed||undefined,opensAt:sealed?new Date(opensMs).toISOString():undefined,eventKey:eventKey||undefined,calls:chosen.slice(0,8).map(d=>({text:d.text.trim(),answerType:d.answerType,options:d.options}))}))onClose()}}>Create & share <Icon name="arrow"/></button></div>
  </>}
 </Sheet>;
}

const days=(to:string,now:number)=>Math.max(0,Math.ceil((Date.parse(to)-now)/86400000));
const dateLabel=(d:string)=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
/** "Seal yours by 31 Dec" · "Opens in 412 days" · "Open it!" */
function sealBadge(m:Moment,status:string,now:number){if(status==='open')return 'Seal yours by '+dateLabel(m.starts_at);if(status==='sealed'){const d=days(m.opens_at!,now);return d<=1?'Opens in '+countdown(m.opens_at!,now):'Opens in '+d+' days'}return status==='done'?'All settled':'Open it!'}

/** The Moment at the top of the Calls tab. */
export function MomentCard({m,calls,me,names,now,lang,onOpen,onPick}:{m:Moment;calls:Call[];me?:string;names:Record<string,string>;now:number;lang:Lang;onOpen:()=>void;onPick:()=>void}){
 const v=momentView(m,calls,now,me),k=KIND[m.kind as MomentKind]||KIND.own;
 const pickers=[...new Set(v.calls.flatMap(c=>c.picker_ids||[]))].map(id=>names[id]).filter(Boolean);
 return <article className={'c-moment '+v.status+(m.sealed?' capsule':'')} onClick={onOpen}>
  <div className="c-moment-top"><span className="c-moment-emoji" aria-hidden="true">{m.sealed&&v.status==='sealed'?'🔒':momentEmoji(m)}</span><Badge tone={v.status==='open'?(Date.parse(m.starts_at)-now<6*3600000?'soon':'neutral'):'later'}>{m.sealed?sealBadge(m,v.status,now):v.status==='open'?(Date.parse(m.starts_at)-now<6*3600000?'Starts in '+countdown(m.starts_at,now):when(m.starts_at,now)):v.status==='live'?'Happening now':'All settled'}</Badge></div>
  <h3>{m.title}</h3>
  <p>{v.calls.length} {v.calls.length===1?'call':'calls'}{pickers.length?' · '+pickers.length+' in':''}{v.status==='live'&&v.settled?' · '+v.settled+' settled':''}</p>
  <div className="c-moment-foot"><Faces names={pickers} size={24}/>{v.status==='open'&&v.toPick.length>0?<button className="c-btn small" onClick={e=>{e.stopPropagation();onPick()}}>{v.toPick.length===v.calls.length?'Make your picks':v.toPick.length+' left to pick'}</button>:<span className="c-link">{v.status==='done'?'See who called it':m.sealed&&v.status==='live'?'Open them':'Open'} <Icon name="arrow" size={16}/></span>}</div>
 </article>;
}

/** A Moment's own page: its calls, the table, the result. */
export function MomentSheet({m,calls,snaps,me,meName,names,now,lang,friends=[],busy=false,onClose,onPick,onReveal,onResolve,onResult,onShare,onAdd,onCeremony,canSet}:{m:Moment|null;calls:Call[];snaps:Snapshot[];me?:string;meName?:string;names:Record<string,string>;now:number;lang:Lang;friends?:string[];busy?:boolean;onClose:()=>void;onPick:(c?:Call)=>void;onReveal:(c:Call)=>void;onResolve:(c:Call)=>void;onResult:(c:Call)=>void;onShare:()=>void;onAdd?:(c:{text:string;answerType:'friend'|'choice'})=>Promise<boolean>;onCeremony?:()=>void;canSet:(c:Call)=>boolean}){
 const [draft,setDraft]=useState('');
 const v=useMemo(()=>m?momentView(m,calls,now,me):null,[m,calls,now,me]);
 const leaders=useMemo(()=>v?momentLeaders(v.calls,snaps):[],[v,snaps]);
 if(!m||!v)return null;
 const k=KIND[m.kind as MomentKind]||KIND.own,top=leaders[0],tied=top?leaders.filter(l=>l.points===top.points&&l.right===top.right):[];
 const kindName=(eventByKey(m.event_key)?.en||(m.kind==='own'?'moment':m.kind==='job'?'new start':k.en)).toLowerCase().replace(/^the /,'');
 return <Sheet open label={m.title} onClose={onClose} full>
  <div className="c-moment-head"><span className="c-moment-emoji big" aria-hidden="true">{momentEmoji(m)}</span><div><span className="c-kicker dark">{m.sealed?(v.status==='open'?'Seal yours by '+dateLabel(m.starts_at)+' · opens '+dateLabel(m.opens_at!):v.status==='sealed'?'🔒 Sealed · opens '+dateLabel(m.opens_at!)+' ('+sealBadge(m,v.status,now).replace('Opens ','')+')':v.status==='live'?'Opened '+dateLabel(m.opens_at!):'All settled'):v.status==='open'?'Picks close '+when(m.starts_at,now):v.status==='live'?'Happening now':'All settled'}</span><h2 className="c-title">{m.title}</h2></div></div>
  {v.status==='open'&&v.toPick.length>0&&<button className="c-btn" onClick={()=>onPick()}>{m.sealed?(v.toPick.length===v.calls.length?'Seal your picks':'Seal the last '+v.toPick.length):v.toPick.length===v.calls.length?'Make your picks':'Pick the last '+v.toPick.length} <Icon name="arrow"/></button>}
  {m.sealed&&v.status==='sealed'&&<div className="c-sealed-note"><span aria-hidden="true">🔒</span><p>Nobody can see any answers until {dateLabel(m.opens_at!)}, not even how the group split. Then everyone opens them together.</p></div>}
  {m.sealed&&v.status==='live'&&onCeremony&&<button className="c-btn" onClick={onCeremony}>Open them one by one <Icon name="arrow"/></button>}
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
     :v.status==='sealed'?<span className="c-lock" aria-label="Sealed">🔒</span>
     :c.state==='open'&&canSet(c)?<button className="c-chip dark" onClick={()=>onResolve(c)}>What happened?</button>
     :!isVoid?<button className="c-chip" onClick={()=>onReveal(c)}>Who said what</button>:null}</div>
   </div>})}</div>
  {m.sealed&&v.status==='open'&&onAdd&&<div className="c-draft add"><input className="c-input" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={240} placeholder="+ Add a prediction for everyone"/><button type="button" className="c-btn small" disabled={busy||draft.trim().length<3} onClick={async()=>{const q=draft.trim();if(await onAdd({text:q,answerType:/^(who|kim)\b|\bkim\b/i.test(q)&&friends.length>=2?'friend':'choice'}))setDraft('')}}>Add</button></div>}
  <button className="c-btn ghost" onClick={onShare}><Icon name="share"/> {v.status==='done'?'Share the result':'Send to the group'}</button>
 </Sheet>;
}

/** Group tab: the group's Moments so far. Its shared memory. */
export function PastMoments({moments,calls,snaps,now,meName,onOpen}:{moments:Moment[];calls:Call[];snaps:Snapshot[];now:number;meName?:string;onOpen:(m:Moment)=>void}){
 const past=moments.filter(m=>momentView(m,calls,now).status==='done');
 if(!past.length)return null;
 return <section className="c-card past"><span className="c-kicker dark">Past Moments</span><div className="c-past">{past.map(m=>{const v=momentView(m,calls,now),l=momentLeaders(v.calls,snaps),top=l[0];
  return <button key={m.id} className="c-past-row" onClick={()=>onOpen(m)}><span className="c-moment-emoji" aria-hidden="true">{momentEmoji(m)}</span><span className="c-past-main"><b>{m.title}</b><small>{new Date(m.starts_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}{top?' · '+(top.name===meName?'You':top.name)+' called '+top.right+'/'+v.settled:''}</small></span><Icon name="arrow" size={16}/></button>})}</div></section>;
}

/** Opening day: one prediction at a time, tap to see who said what, then say what happened. */
export function OpeningSheet({m,calls,snaps,meName,now,onResolve,onClose}:{m:Moment|null;calls:Call[];snaps:Snapshot[];meName?:string;now:number;onResolve:(c:Call)=>void;onClose:()=>void}){
 const [i,setI]=useState(0),[shown,setShown]=useState(false);
 useEffect(()=>{setI(0);setShown(false)},[m?.id]);
 if(!m)return null;
 const list=momentView(m,calls,now).calls,c=list[Math.min(i,list.length-1)];if(!c)return null;
 const groups=reveal(c,snaps).filter(g=>g.names.length).sort((a,b)=>b.names.length-a.names.length),total=groups.reduce((n,g)=>n+g.names.length,0);
 const last=i>=list.length-1;
 return <Sheet open dark full label="Opening" onClose={onClose}>
  <div className="c-open-top"><span className="c-kicker">{m.title}</span><span className="c-open-count">{i+1} / {list.length}</span></div>
  <div className="c-steps c-open-steps" aria-hidden="true">{list.map((_,k)=><i key={k} className={k<i?'done':k===i?'now':''}/>)}</div>
  <h2 className="c-title big">{c.text}</h2>
  {!shown?<button className="c-reveal-btn" onClick={()=>setShown(true)}><span aria-hidden="true">🔓</span>Tap to see what everyone said</button>
  :<><div className="c-reveal">{groups.length?groups.map(g=>{const mine=g.names.some(n=>n.name===meName);return <div key={g.answer} className={'c-group'+(mine?' mine':'')}>
    <div className="c-group-head"><b>{label(g.answer,c)}</b><span>{g.names.length} {g.names.length===1?'friend':'friends'}</span></div>
    <div className="c-names">{g.names.map(n=><span key={n.name}><Face name={n.name} size={26}/>{n.name===meName?'You':n.name}</span>)}</div></div>}):<p className="c-sub light">Nobody sealed an answer for this one.</p>}</div>
   {c.state==='settled'?<p className="c-sub light"><b>{label(c.result_answer||'',c)}</b> it was. {total?groups.find(g=>g.answer===c.result_answer)?.names.length||0:0} of {total} saw it coming.</p>
   :c.state==='proposed'?<p className="c-sub light">Someone said: <b>{label(c.proposed_answer||'',c)}</b>. Counts in a day unless someone says it’s not right.</p>
   :c.state==='open'?<button className="c-btn" onClick={()=>onResolve(c)}>What happened?</button>:null}</>}
  <div className="c-open-nav">{i>0&&<button className="c-link light" onClick={()=>{setI(i-1);setShown(true)}}>Back</button>}<button className="c-btn dark-lime" onClick={()=>{if(last)onClose();else{setI(i+1);setShown(false)}}}>{last?'Done':'Next prediction'} <Icon name="arrow"/></button></div>
 </Sheet>;
}
