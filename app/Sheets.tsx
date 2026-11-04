'use client';
import {useEffect,useState} from 'react';
import {Sheet,Face,Faces,Icon,Badge,Split} from './ui';
import {type Call,type Snapshot,answersOf,label,reveal,headline,potential,pts} from './calls';
import {countdown,when} from './format';
import {shareMessage,copyText} from './share';
import {whatsappLink} from '../lib/sharing';
import {BRAND} from '../lib/brand';

export const LEVELS=[{name:'Hunch',pts:10},{name:'Sure',pts:20},{name:'Certain',pts:30}] as const;

/** Make (or change) your call: pick an answer, say how sure you are, lock it in. */
export function PickSheet({call,preset,names,left,longCount,now,busy,onSave,onClose}:{call:Call|null;preset?:string;names:Record<string,string>;left:number;longCount:number;now:number;busy:boolean;onSave:(c:Call,answer:string,stake:number)=>Promise<boolean>;onClose:()=>void}){
 const [answer,setAnswer]=useState(''),[stake,setStake]=useState(20);
 useEffect(()=>{if(call){setAnswer(preset||call.answer||'');setStake(call.stake&&LEVELS.some(l=>l.pts===call.stake)?call.stake:left+(call.stake||0)>=20?20:10)}},[call?.id,preset]);
 if(!call)return null;
 const long=call.scope==='longterm',budget=left+(call.answer?call.stake||0:0);
 const pickers=(call.picker_ids||[]).map(id=>names[id]).filter(Boolean);
 const fullLong=long&&!call.answer&&longCount>=3;
 const canSave=!!answer&&!busy&&!fullLong&&(long||stake<=budget);
 return <Sheet open label="Make your call" onClose={onClose}>
  <div className="c-sheet-head">{long?<Badge tone="later">{call.event_at?'We’ll know in '+new Date(call.event_at).toLocaleDateString('en-GB',{month:'long'}):'Later'}</Badge>:<Badge tone="soon">Locks in {countdown(call.locks_at,now)}</Badge>}</div>
  <h2 className="c-title">{call.text}</h2>
  <p className="c-sub">{call.creator_name}’s call{pickers.length?' · '+pickers.length+' in':''} · {call.split?'who said what stays secret until it locks':'make your call to see how the group is split'}</p>
  {call.split&&<div className="c-split-box"><span className="c-label">How the group is split so far</span><Split answers={answersOf(call)} counts={call.split} mine={call.answer} label={label}/></div>}
  <div className={'c-options'+(answersOf(call).length>2?' stack':' pair')} role="radiogroup" aria-label="Your answer">{answersOf(call).map(a=><button key={a} role="radio" aria-checked={answer===a} className={'c-opt'+(answer===a?' on':'')} onClick={()=>setAnswer(a)}><span>{label(a)}</span>{answer===a&&<Icon name="check" size={20} stroke={2.6}/>}</button>)}</div>
  {!long?<div className="c-levels-wrap"><span className="c-label">How sure are you?</span><div className="c-levels" role="radiogroup" aria-label="How sure are you">{LEVELS.map(l=><button key={l.name} role="radio" aria-checked={stake===l.pts} disabled={l.pts>budget} className={'c-level'+(stake===l.pts?' on':'')} onClick={()=>setStake(l.pts)}><b>{l.name}</b><small>{l.pts} pts</small></button>)}</div>
   <p className="c-hint">{budget<10?'You’ve used all 100 points this week. Free up some by changing another call.':'Right = up to 2× back. The fewer friends with you, the more you score.'}</p></div>
  :<p className="c-hint">Later calls are worth 10 pts each and count for the season.{fullLong?' You already have 3 going: wait for one to finish.':''}</p>}
  <button className="c-btn" disabled={!canSave} onClick={async()=>{if(await onSave(call,answer,long?10:stake))onClose()}}>{!answer?'Pick one first':call.answer?'Update: '+label(answer)+(long?'':' · '+stake+' pts'):'Lock in '+label(answer)+(long?'':' · '+stake+' pts')}</button>
 </Sheet>;
}

/** After the lock: who said what. */
export function RevealSheet({call,snaps,me,meName,onClose}:{call:Call|null;snaps:Snapshot[];me?:string;meName?:string;onClose:()=>void}){
 if(!call)return null;
 const groups=reveal(call,snaps),total=groups.reduce((n,g)=>n+g.names.length,0),max=Math.max(1,...groups.map(g=>g.names.length));
 const mine=groups.find(g=>g.names.some(n=>n.id===me||n.name===meName));const myStake=mine?.names.find(n=>n.id===me||n.name===meName)?.stake||0;
 return <Sheet open dark full label="Who said what" onClose={onClose}>
  <span className="c-kicker">Locked · picks are out</span>
  <h2 className="c-title big">{call.text}</h2>
  <p className="c-sub light">{headline(groups,meName)}</p>
  <div className="c-reveal">{[...groups].sort((a,b)=>b.names.length-a.names.length).map(g=>{const isMine=g===mine;const alone=g.names.length===1&&total>2;return <div key={g.answer} className={'c-group'+(isMine?' mine':'')+(g.names.length?'':' empty')}>
   <div className="c-group-head"><b>{label(g.answer)}</b>{alone&&isMine?<span className="c-tag">Lone wolf</span>:<span>{g.names.length?g.names.length+(g.names.length===1?' friend':' friends'):'nobody'}</span>}</div>
   {g.names.length>0&&<><div className="c-bar"><i style={{width:(g.names.length/max*100)+'%'}}/></div><div className="c-names">{g.names.map(n=><span key={n.name}><Face name={n.name} size={26}/>{n.name===meName?'You':n.name}</span>)}</div></>}
   {isMine&&call.scope!=='longterm'&&total>0&&<p className="c-if">If it’s {label(g.answer)}, you score +{potential(myStake,g.names.length,total)}.</p>}
  </div>})}</div>
 </Sheet>;
}

/** The result moment: called it, or not this time. */
export function ResultSheet({call,snaps,meName,onClose,onShare}:{call:Call|null;snaps:Snapshot[];meName?:string;onClose:()=>void;onShare:(c:Call,text:string)=>void}){
 if(!call)return null;
 const groups=reveal(call,snaps),right=groups.find(g=>g.answer===call.result_answer)?.names||[],wrong=groups.filter(g=>g.answer!==call.result_answer).flatMap(g=>g.names);
 const won=!!call.answer&&call.answer===call.result_answer,score=pts(call.points_tenths);
 if(call.state==='void')return <Sheet open label="Result" onClose={onClose}><span className="c-kicker dark">{call.text}</span><h2 className="c-title big">Called off.</h2><p className="c-sub">Nobody could settle this one, so everyone gets their points back.</p><button className="c-btn" onClick={onClose}>OK</button></Sheet>;
 const others=right.filter(n=>n.name!==meName).map(n=>n.name);
 return <Sheet open label="Result" onClose={onClose} full><div className={'c-result'+(won?' won':'')}>
  {won&&<div className="c-confetti" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i}/>)}</div>}
  <span className="c-kicker dark">{call.text}</span>
  <h3 className="c-it">{label(call.result_answer||'')} it is.</h3>
  {won?<><Face name={meName||'You'} size={88} ring="#17201B"/><h2 className="c-huge">You called it.</h2><p className="c-sub dark">{others.length?'With '+others.join(', ')+'.':right.length===1&&groups.reduce((n,g)=>n+g.names.length,0)>1?'The only one in the group.':'Nice.'}</p><span className="c-score">+{score}</span></>
  :<><h2 className="c-huge">{call.answer?'Not this time.':'You sat this one out.'}</h2><p className="c-sub dark">{right.length?(right.length===1?right[0].name+' was the only one who called it.':right.map(n=>n.name).join(', ')+' called it.'):'Nobody saw that coming.'}</p></>}
  {(won?wrong:right).length>0&&<div className="c-also"><span>{won?'Better luck next time':'Called it'}</span><Faces names={(won?wrong:right).map(n=>n.name)} size={30}/></div>}
  {won&&<button className="c-btn dark" onClick={()=>onShare(call,`Called it: ${label(call.result_answer||'')}. ${call.text} +${score} for me`)}><Icon name="share"/> Rub it in the group chat</button>}
  <button className="c-link" onClick={onClose}>Back to calls</button>
 </div></Sheet>;
}

/** The creator (or the judge) says what happened. */
export function ResolveSheet({call,mode,busy,onPick,onClose}:{call:Call|null;mode:'set'|'judge';busy:boolean;onPick:(c:Call,answer:string)=>Promise<boolean>;onClose:()=>void}){
 const [pick,setPick]=useState('');useEffect(()=>setPick(''),[call?.id]);
 if(!call)return null;
 return <Sheet open label="What happened?" onClose={onClose}>
  <span className="c-kicker dark">{mode==='judge'?'You’re the judge':'What happened?'}</span>
  <h2 className="c-title">{call.text}</h2>
  <p className="c-sub">{mode==='judge'?`Someone said ${call.proposed_by?'the result':'it'} wasn’t right. Your answer is final.`:'Everyone gets a day to say if it’s not right. Then it counts.'}</p>
  <div className={'c-options'+(answersOf(call).length>2?' stack':' pair')}>{answersOf(call).map(a=><button key={a} className={'c-opt'+(pick===a?' on':'')} onClick={()=>setPick(a)}><span>It was {label(a)}</span>{pick===a&&<Icon name="check" size={20} stroke={2.6}/>}</button>)}</div>
  <button className="c-btn" disabled={!pick||busy} onClick={async()=>{if(await onPick(call,pick))onClose()}}>{pick?'Set the result: '+label(pick):'Choose what happened'}</button>
 </Sheet>;
}

/** Put a link in the group chat: one tidy message, the preview does the rest. */
export function ShareSheet({open,title,text,url,preview,onClose,onDone}:{open:boolean;title:string;text:string;url:string;preview?:React.ReactNode;onClose:()=>void;onDone:(msg:string)=>void}){
 return <Sheet open={open} label={title} onClose={onClose}>
  <span className="c-kicker dark">{title}</span>
  {preview}
  <div className="c-share-msg"><p>{text.replace(url,'').trim()}</p><span>{url.replace(/^https?:\/\//,'')}</span></div>
  <button className="c-btn" data-autofocus onClick={async()=>{const r=await shareMessage(text);if(r==='copied')onDone('Copied. Paste it in the group chat.');else if(r==='shared')onClose();else if(r==='failed')onDone('Couldn’t open sharing. Copy the link instead.')}}><Icon name="share"/> Share</button>
  <div className="c-row2"><a className="c-btn ghost" href={whatsappLink(text)} target="_blank" rel="noreferrer">WhatsApp</a><button className="c-btn ghost" onClick={async()=>onDone(await copyText(url)?'Link copied.':'Couldn’t copy the link.')}><Icon name="link"/> Copy link</button></div>
 </Sheet>;
}

/** A small picture of the call, the way it shows up in the chat. */
export function CallPreview({call,groupName,pickers}:{call:{text:string;options?:string[]|null;locks_at:string;scope:string;event_at:string|null;creator_name:string};groupName:string;pickers:string[]}){
 return <div className="c-preview"><div className="c-preview-top"><span className="c-brandmark">{BRAND}</span><Badge tone={call.scope==='longterm'?'later':'soon'}>{call.scope==='longterm'&&call.event_at?'We’ll know in '+new Date(call.event_at).toLocaleDateString('en-GB',{month:'long'}):'Picks close '+when(call.locks_at)}</Badge></div>
  <b>{call.text}</b><div className={'c-preview-opts n'+Math.min(4,answersOf(call).length)}>{answersOf(call).map((a,i)=><span key={a} className={i===0?'on':''}>{label(a)}</span>)}</div>
  <div className="c-preview-foot"><Faces names={[call.creator_name,...pickers.filter(p=>p!==call.creator_name)]} size={20} ring="#17201B"/><span>{call.creator_name}’s call in {groupName}</span></div></div>;
}
