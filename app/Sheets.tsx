'use client';
import {revealHeadline} from '../lib/reveal';
import {t,L,lang} from './i18n';
import {useEffect,useState} from 'react';
import {Sheet,Face,Faces,Icon,Badge,Split} from './ui';
import {type Call,type Snapshot,answersOf,label,reveal,headline,pts} from './calls';
import {MatchHead} from './CallsTab';
import {countdown,when} from './format';
import {shareMessage,copyText} from './share';
import {whatsappLink} from '../lib/sharing';
import {BRAND} from '../lib/brand';

/** Make (or change) your call: tap an answer, lock it in. Nothing to spend. With `step`, it walks through every open call one after another. */
export function PickSheet({call,preset,names,longCount,now,busy,step,onSkip,onSave,onClose}:{call:Call|null;preset?:string;names:Record<string,string>;longCount:number;now:number;busy:boolean;step?:{n:number;of:number};onSkip?:()=>void;onSave:(c:Call,answer:string)=>Promise<boolean>;onClose:()=>void}){
 const [answer,setAnswer]=useState('');
 useEffect(()=>{if(call)setAnswer(preset||call.answer||'')},[call?.id,preset]);
 if(!call)return null;
 const long=call.scope==='longterm';
 const pickers=(call.picker_ids||[]).map(id=>names[id]).filter(Boolean);
 const fullLong=long&&!call.answer&&longCount>=3;
 const canSave=!!answer&&!busy&&!fullLong;
 const more=!!step&&step.n<step.of;
 return <Sheet open label={t("Make your call")} onClose={onClose}>
  <div className="c-sheet-head">{step&&step.of>1&&<div className="c-steps" aria-label={t('Call ')+step.n+' of '+step.of}>{Array.from({length:Math.min(step.of,20)},(_,i)=><i key={i} className={i<step.n-1?'done':i===step.n-1?'now':''}/>)}</div>}{long?<Badge tone="later">{call.event_at?t('We’ll know in ')+new Date(call.event_at).toLocaleDateString('en-GB',{month:'long'}):t('Later')}</Badge>:<Badge tone="soon">{call.match?t('Kick-off in '):t('Locks in ')}{countdown(call.locks_at,now)}</Badge>}</div>
  {call.match?<><MatchHead c={call}/><p className="c-sub center">{t('Who wins? (90 minutes)')}</p></>
  :<><h2 className="c-title">{call.text}</h2><p className="c-sub">{call.creator_name}{pickers.length?' · '+pickers.length+L(' in',' kişi'):''}</p></>}
  {call.split&&<div className="c-split-box"><span className="c-label">{t('How the group is split so far')}</span><Split answers={answersOf(call)} counts={call.split} mine={call.answer} label={a=>label(a,call)}/></div>}
  {call.answer_type==='friend'?<FacePicker names={answersOf(call)} value={answer} onPick={setAnswer}/>
  :<div className={'c-options'+(answersOf(call).length>2?' stack':' pair')} role="radiogroup" aria-label={t("Your answer")}>{answersOf(call).map(a=><button key={a} role="radio" aria-checked={answer===a} className={'c-opt'+(answer===a?' on':'')} onClick={()=>setAnswer(a)}><span>{label(a,call)}</span>{answer===a&&<Icon name="check" size={20} stroke={2.6}/>}</button>)}</div>}
  <p className="c-hint">{long?t('Later calls count for the season.')+(fullLong?t(' You already have 3 going: wait for one to finish.'):''):t('Right calls score 10 to 40: the fewer friends who see it coming, the more you get.')}</p>
  <button className="c-btn" disabled={!canSave} onClick={async()=>{if(await onSave(call,answer)&&!more)onClose()}}>{!answer?t('Pick one first'):(more?t('Lock in & next'):call.answer?t('Update to '):t('Lock in '))+(more?'':label(answer,call))}{more&&answer&&<Icon name="arrow" size={18}/>}</button>
  {more&&onSkip&&<button className="c-link center" onClick={onSkip}>{t('Skip for now')}</button>}
 </Sheet>;
}

/** "Who…?" calls: the answers are your friends' faces. */
export function FacePicker({names,value,onPick,big=false}:{names:string[];value:string;onPick:(n:string)=>void;big?:boolean}){
 return <div className={'c-face-opts'+(big?' big':'')} role="radiogroup" aria-label={t("Pick a friend")}>{names.map(n=><button key={n} type="button" role="radio" aria-checked={value===n} className={value===n?'on':''} onClick={()=>onPick(n)}><Face name={n} size={big?54:48} ring={value===n?'#17201B':'#FFFFFF'}/><span>{n}</span></button>)}</div>;
}

/** After the lock: who said what. */
export function RevealSheet({call,snaps,me,meName,onClose,onShare}:{call:Call|null;snaps:Snapshot[];me?:string;meName?:string;onClose:()=>void;onShare?:(c:Call)=>void}){
 if(!call)return null;
 const groups=reveal(call,snaps),total=groups.reduce((n,g)=>n+g.names.length,0),max=Math.max(1,...groups.map(g=>g.names.length));
 // "Who…?" calls get the big moment: whose face won, and how many said it.
 const rows=call.answer_type==='friend'?groups.filter(g=>g.names.length).map(g=>({name:label(g.answer,call),count:g.names.length})).sort((a,b)=>b.count-a.count):[];
 const top=rows[0],tied=!!rows[1]&&rows[1].count===top?.count,meTop=!!top&&!!meName&&top.name.toLocaleLowerCase('tr')===meName.toLocaleLowerCase('tr');
 const shareable=!!onShare&&rows.length>0&&total>=2&&!(call.subject_id&&call.state!=='settled');
 const mine=groups.find(g=>g.names.some(n=>n.id===me||n.name===meName));const myStake=mine?.names.find(n=>n.id===me||n.name===meName)?.stake||0;
 return <Sheet open dark full label={t("Who said what")} onClose={onClose}>
  <span className="c-kicker">{t('Locked · picks are out')}</span>
  {top?<><p className="c-reveal-q">{call.text}</p>
   <div className="c-reveal-hero"><span className="c-reveal-face"><Face name={top.name} size={112}/>{!tied&&<i aria-hidden="true">👑</i>}</span><h2>{revealHeadline(rows,total,lang(),meName)}{meTop?' 😭':''}</h2></div>
   {shareable&&<button className="c-btn lime" onClick={()=>onShare!(call)}><Icon name="share"/> {t('Share the reveal')}</button>}</>
  :<><h2 className="c-title big">{call.text}</h2><p className="c-sub light">{headline(groups,meName,call)}</p></>}
  <div className="c-reveal">{[...groups].sort((a,b)=>b.names.length-a.names.length).map(g=>{const isMine=g===mine;const alone=g.names.length===1&&total>2;return <div key={g.answer} className={'c-group'+(isMine?' mine':'')+(g.names.length?'':' empty')}>
   <div className="c-group-head"><b>{label(g.answer,call)}</b>{alone&&isMine?<span className="c-tag">{t('Lone wolf')}</span>:<span>{g.names.length?g.names.length+L(g.names.length===1?' friend':' friends',' kişi'):L('nobody','kimse')}</span>}</div>
   {g.names.length>0&&<><div className="c-bar"><i style={{width:(g.names.length/max*100)+'%'}}/></div><div className="c-names">{g.names.map(n=><span key={n.name}><Face name={n.name} size={26}/>{n.name===meName?t('You'):n.name}</span>)}</div></>}
   {isMine&&call.scope!=='longterm'&&total>1&&<p className="c-if">{g.names.length===1?t('You’re the only one. If you’re right, that’s a bold call.'):g.names.length*2<total?t('You’re with the few. Right would be a bold call.'):t('You’re with the crowd.')}</p>}
  </div>})}</div>
 </Sheet>;
}

/** The result moment: called it, or not this time. */
export function ResultSheet({call,snaps,meName,onClose,onShare}:{call:Call|null;snaps:Snapshot[];meName?:string;onClose:()=>void;onShare:(c:Call,text:string)=>void}){
 if(!call)return null;
 const groups=reveal(call,snaps),right=groups.find(g=>g.answer===call.result_answer)?.names||[],wrong=groups.filter(g=>g.answer!==call.result_answer).flatMap(g=>g.names);
 const won=!!call.answer&&call.answer===call.result_answer,score=pts(call.points_tenths);
 if(call.state==='void')return <Sheet open label={t("Result")} onClose={onClose}><span className="c-kicker dark">{call.text}</span><h2 className="c-title big">{t('Called off.')}</h2><p className="c-sub">{t('It couldn’t be settled, so it doesn’t count for anyone.')}</p><button className="c-btn" onClick={onClose}>OK</button></Sheet>;
 const others=right.filter(n=>n.name!==meName).map(n=>n.name);
 return <Sheet open label={t("Result")} onClose={onClose} full><div className={'c-result'+(won?' won':'')}>
  {won&&<div className="c-confetti" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i}/>)}</div>}
  <span className="c-kicker dark">{call.text}</span>
  <h3 className="c-it">{call.match&&call.match.home90!=null?call.match.home+' '+call.match.home90+'–'+call.match.away90+' '+call.match.away:label(call.result_answer||'',call)+t(' it is.')}</h3>
  {won?<><Face name={meName||t('You')} size={88} ring="#17201B"/><h2 className="c-huge">{t('You called it.')}</h2><p className="c-sub dark">{others.length?t('With ')+others.join(', ')+'.':right.length===1&&groups.reduce((n,g)=>n+g.names.length,0)>1?t('The only one in the group.'):t('Nice.')}</p><span className="c-score">+{score}</span><p className="c-sub dark">{right.length} of {groups.reduce((n,g)=>n+g.names.length,0)} called it{right.length===1?t(': a bold call.'):'.'} {t('The fewer who see it coming, the more it’s worth.')}</p></>
  :<><h2 className="c-huge">{call.answer?t('Not this time.'):t('You sat this one out.')}</h2><p className="c-sub dark">{right.length?(right.length===1?right[0].name+t(' was the only one who called it.'):right.map(n=>n.name).join(', ')+t(' called it.')):t('Nobody saw that coming.')}</p></>}
  {(won?wrong:right).length>0&&<div className="c-also"><span>{won?t('Better luck next time'):t('Called it')}</span><Faces names={(won?wrong:right).map(n=>n.name)} size={30}/></div>}
  {won&&<button className="c-btn dark" onClick={()=>onShare(call,`Called it: ${label(call.result_answer||'',call)}. ${call.text} +${score} for me`)}><Icon name="share"/> {t('Rub it in the group chat')}</button>}
  <button className="c-link" onClick={onClose}>{t('Back to calls')}</button>
 </div></Sheet>;
}

/** The creator (or the judge) says what happened. */
export function ResolveSheet({call,mode,busy,onPick,onClose}:{call:Call|null;mode:'set'|'judge';busy:boolean;onPick:(c:Call,answer:string)=>Promise<boolean>;onClose:()=>void}){
 const [pick,setPick]=useState('');useEffect(()=>setPick(''),[call?.id]);
 if(!call)return null;
 return <Sheet open label={t("What happened?")} onClose={onClose}>
  <span className="c-kicker dark">{mode==='judge'?t('You’re the judge'):t('What happened?')}</span>
  <h2 className="c-title">{call.text}</h2>
  <p className="c-sub">{mode==='judge'?`Someone said ${call.proposed_by?'the result':'it'} wasn’t right. Your answer is final.`:t('Everyone gets a day to say if it’s not right. Then it counts.')}</p>
  <div className={'c-options'+(answersOf(call).length>2?' stack':' pair')}>{answersOf(call).map(a=><button key={a} className={'c-opt'+(pick===a?' on':'')} onClick={()=>setPick(a)}><span>{t('It was')} {label(a,call)}</span>{pick===a&&<Icon name="check" size={20} stroke={2.6}/>}</button>)}</div>
  <button className="c-btn" disabled={!pick||busy} onClick={async()=>{if(await onPick(call,pick))onClose()}}>{pick?t('Set the result: ')+label(pick,call):t('Choose what happened')}</button>
 </Sheet>;
}

/** Put a link in the group chat: one tidy message, the preview does the rest. */
export function ShareSheet({open,title,text,url,preview,tags,tag,onTag,onClose,onDone}:{open:boolean;title:string;text:string;url:string;preview?:React.ReactNode;tags?:string[];tag?:string;onTag?:(n:string)=>void;onClose:()=>void;onDone:(msg:string)=>void}){
 return <Sheet open={open} label={title} onClose={onClose}>
  <span className="c-kicker dark">{title}</span>
  {preview}
  {!!tags?.length&&onTag&&<div className="c-tag-row"><span>{t('Not in yet? Send one their own link:')}</span><div className="c-chips">{tags.map(n=><button key={n} type="button" className={'c-chip-name'+(tag===n?' on':'')} aria-pressed={tag===n} onClick={()=>onTag(n)}><Face name={n} size={24}/>{n}</button>)}</div></div>}
  <div className="c-share-msg"><p>{text.replace(url,'').trim()}</p><span>{url.replace(/^https?:\/\//,'')}</span></div>
  <button className="c-btn" data-autofocus onClick={async()=>{const r=await shareMessage(text);if(r==='copied')onDone('Copied. Paste it in the group chat.');else if(r==='shared')onClose();else if(r==='failed')onDone('Couldn’t open sharing. Copy the link instead.')}}><Icon name="share"/> {t('Share')}</button>
  <div className="c-row2"><a className="c-btn ghost" href={whatsappLink(text)} target="_blank" rel="noreferrer">{t('WhatsApp')}</a><button className="c-btn ghost" onClick={async()=>onDone(await copyText(url)?'Link copied.':'Couldn’t copy the link.')}><Icon name="link"/> {t('Copy link')}</button></div>
 </Sheet>;
}

/** A small picture of the call, the way it shows up in the chat. */
export function CallPreview({call,groupName,pickers,foot}:{call:{text:string;options?:string[]|null;market?:string;match?:Call['match'];locks_at:string;scope:string;event_at:string|null;creator_name:string};groupName:string;pickers:string[];foot?:string}){
 return <div className="c-preview"><div className="c-preview-top"><span className="c-brandmark">{BRAND}</span><Badge tone={call.scope==='longterm'?'later':'soon'}>{call.scope==='longterm'&&call.event_at?t('We’ll know in ')+new Date(call.event_at).toLocaleDateString('en-GB',{month:'long'}):t('Picks close ')+when(call.locks_at)}</Badge></div>
  <b>{call.text}</b><div className={'c-preview-opts n'+Math.min(4,answersOf(call).length)}>{answersOf(call).map((a,i)=><span key={a} className={i===0?'on':''}>{label(a,call)}</span>)}</div>
  <div className="c-preview-foot"><Faces names={foot?pickers:[call.creator_name,...pickers.filter(p=>p!==call.creator_name)]} size={20} ring="#17201B"/><span>{foot||call.creator_name+t('’s call in ')+groupName}</span></div></div>;
}
