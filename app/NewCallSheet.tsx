'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Sheet,Face,Icon} from './ui';
import {whenChoices,laterMonths,type Choice} from './when-presets';

const IDEAS=['Who’s late first on Saturday?','Will everyone actually show up?','Derby score?','Who cancels first?'];
export type NewCall={action:'question'|'longterm';text:string;options?:string[];locksAt:string;eventAt?:string;subjectId?:string};

/** Make a call: the question, the answers, and when we'll know. */
export function NewCallSheet({open,now,practice,weeklyOpen,weeklyWhy,deadline,members,busy,onCreate,onClose}:{open:boolean;now:number;practice:boolean;weeklyOpen:boolean;weeklyWhy?:string;deadline:number|null;members:{id:string;name:string}[];busy:boolean;onCreate:(c:NewCall)=>Promise<boolean>;onClose:()=>void}){
 const [text,setText]=useState(''),[multi,setMulti]=useState(false),[opts,setOpts]=useState(['','']),[when,setWhen]=useState<Choice['id']>('week'),[month,setMonth]=useState<number|undefined>(),[subject,setSubject]=useState(''),[custom,setCustom]=useState(''),[showCustom,setShowCustom]=useState(false);
 const choices=useMemo(()=>whenChoices(now,{practice,weeklyOpen,weeklyWhy,deadline,month}),[now,practice,weeklyOpen,weeklyWhy,deadline,month]);
 const months=useMemo(()=>laterMonths(now),[now]);
 const started=useRef(false);
 useEffect(()=>{if(!open){started.current=false;return}if(started.current)return;started.current=true;setText('');setMulti(false);setOpts(['','']);setSubject('');setCustom('');setShowCustom(false);setMonth(undefined);const first=choices.find(c=>c.ok&&c.id!=='later');setWhen(first?first.id:'later')},[open]);
 const chosen=choices.find(c=>c.id===when)!;
 const options=multi?opts.map(o=>o.trim()).filter(Boolean):[];
 const customLock=showCustom&&custom&&when!=='later'?new Date(custom).getTime():null;
 const valid=text.trim().length>=3&&chosen.ok&&(!multi||options.length>=2)&&(!customLock||(customLock>now&&(!deadline||customLock<=deadline)));
 async function submit(){
  const lock=customLock||chosen.lock;
  const ok=await onCreate({action:when==='later'?'longterm':'question',text:text.trim(),options:options.length?options:undefined,locksAt:new Date(lock).toISOString(),eventAt:chosen.event?new Date(chosen.event).toISOString():undefined,subjectId:subject||undefined});
  if(ok)onClose();
 }
 const badge=when==='later'?(practice?'We’ll know in 30 min':'We’ll know in '+(months.find(m=>m.index===month)||months[0])?.name):'Picks close '+new Date(customLock||chosen.lock).toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'});
 return <Sheet open={open} label="New call" onClose={onClose} full>
  <label className="c-big-label" htmlFor="call-text">What’s the call?</label>
  <textarea id="call-text" className="c-question" rows={2} maxLength={240} value={text} onChange={e=>setText(e.target.value)} placeholder="Will Can bring up crypto at dinner?"/>
  {!text&&<div className="c-ideas"><span>Ideas:</span>{IDEAS.map(i=><button key={i} type="button" onClick={()=>setText(i)}>{i}</button>)}</div>}

  <span className="c-label">Answers</span>
  <div className="c-seg"><button type="button" className={!multi?'on':''} onClick={()=>setMulti(false)}>Yes / No</button><button type="button" className={multi?'on':''} onClick={()=>setMulti(true)}>Options</button></div>
  {multi&&<div className="c-opt-inputs">{opts.map((o,i)=><input key={i} aria-label={'Option '+(i+1)} maxLength={40} value={o} placeholder={['Aykut','Nagelsmann','Someone else','Nobody'][i]} onChange={e=>setOpts(opts.map((x,j)=>j===i?e.target.value:x))}/>)}{opts.length<4&&<button type="button" className="c-add" onClick={()=>setOpts([...opts,''])}>+ Add</button>}</div>}

  <span className="c-label">When will we know?</span>
  <div className="c-when">{choices.map(c=><button type="button" key={c.id} className={(when===c.id?'on':'')+(c.ok?'':' off')} aria-pressed={when===c.id} onClick={()=>setWhen(c.id)}><b>{c.label}</b><small>{c.sub}</small></button>)}</div>
  {when==='later'&&!practice&&<div className="c-months">{months.map(m=><button type="button" key={m.index} className={(month??months[0]?.index)===m.index?'on':''} onClick={()=>setMonth(m.index)}>{m.name}</button>)}</div>}
  {!chosen.ok?<p className="c-hint warn">{chosen.why||'Not available right now. Try Later.'}</p>:choices.some(c=>!c.ok&&c.id!=='tonight')&&<p className="c-hint">{weeklyWhy}</p>}
  {when!=='later'&&chosen.ok&&<button type="button" className="c-link small" onClick={()=>setShowCustom(!showCustom)}>{showCustom?'Use the suggested time':'Pick an exact time'}</button>}
  {showCustom&&when!=='later'&&<input className="c-input" type="datetime-local" aria-label="Picks close at" value={custom} onChange={e=>setCustom(e.target.value)}/>}

  {members.length>0&&<><span className="c-label">About someone? <small>They get a heads-up, but can’t see it until it’s settled.</small></span><div className="c-about">{members.map(m=><button type="button" key={m.id} className={subject===m.id?'on':''} aria-pressed={subject===m.id} onClick={()=>setSubject(subject===m.id?'':m.id)}><Face name={m.name} size={26}/>{m.name}</button>)}</div></>}

  <div className="c-sheet-foot"><span className={'c-badge '+(when==='later'?'later':'soon')}>{badge}</span>
  <button className="c-btn" disabled={!valid||busy} onClick={submit}>Post it <Icon name="arrow"/></button></div>
 </Sheet>;
}
