'use client';
import {t,L} from './i18n';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Sheet,Face,Icon} from './ui';
import {whenChoices,laterMonths,type Choice} from './when-presets';
import {starters} from '../lib/moment-starters';

/** Three starters, nothing more: they set the tone, then people write their own. */
export const EXAMPLES={
 tr:['Halı sahada en çok golü kim atar?','Akşamı kim eker?','En son kim evlenir?'],
 en:['Who scores the most at five-a-side?','Who bails on tonight?','Who gets married last?'],
};
type Kind='friend'|'yesno'|'options';
/** A sealed call: picks close on one date, answers stay hidden until another, then the group opens them together. */
export type SealedCall={kind:'own'|'year';title:string;startsAt:string;sealed:true;opensAt:string;calls:{text:string;answerType:'friend'|'choice';options?:string[]}[]};
export type SealPreset={kind:'year';closes:number;opens:number};
/** datetime-local value for a timestamp, in this phone's time. */
const local=(ms:number)=>{const d=new Date(ms);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const atNine=(ms:number)=>{const d=new Date(ms);d.setHours(21,0,0,0);return d.getTime()};
export type NewCall={action:'question'|'longterm';text:string;options?:string[];answerType?:'friend'|'choice';locksAt:string;eventAt?:string;subjectId?:string;resolverId?:string};

/** Make a call: the question, the answers, and when we'll know. */
export function NewCallSheet({seal:sealPreset,onSeal,isAdmin=false,open,now,practice,weeklyOpen,weeklyWhy,deadline,members,friendNames=[],lang='en',first=false,busy,onCreate,onClose}:{seal?:SealPreset;onSeal?:(m:SealedCall)=>Promise<boolean>;open:boolean;now:number;practice:boolean;weeklyOpen:boolean;weeklyWhy?:string;deadline:number|null;members:{id:string;name:string}[];friendNames?:string[];lang?:'tr'|'en';first?:boolean;busy:boolean;isAdmin?:boolean;onCreate:(c:NewCall)=>Promise<boolean>;onClose:()=>void}){
 const [settler,setSettler]=useState('');
 const [sealed,setSealed]=useState(false),[closes,setCloses]=useState(''),[opens,setOpens]=useState('');
 const canFriend=friendNames.length>=2;
 const [kind,setKind]=useState<Kind>(canFriend?'friend':'yesno');const multi=kind==='options',setMulti=(m:boolean)=>setKind(m?'options':'yesno');
 const [text,setText]=useState(''),[opts,setOpts]=useState(['','']),[when,setWhen]=useState<Choice['id']>('week'),[month,setMonth]=useState<number|undefined>(),[subject,setSubject]=useState(''),[custom,setCustom]=useState(''),[showCustom,setShowCustom]=useState(false);
 const choices=useMemo(()=>whenChoices(now,{practice,weeklyOpen,weeklyWhy,deadline,month}),[now,practice,weeklyOpen,weeklyWhy,deadline,month]);
 const months=useMemo(()=>laterMonths(now),[now]);
 const started=useRef(false);
 useEffect(()=>{if(!open){started.current=false;return}if(started.current)return;started.current=true;setText('');setKind(canFriend?'friend':'yesno');setOpts(['','']);setSubject('');setSettler('');setCustom('');setShowCustom(false);setMonth(undefined);{const c=sealPreset?.closes??atNine(now+7*86400000),o=sealPreset?.opens??atNine(c+30*86400000);setSealed(!!sealPreset);setCloses(local(c));setOpens(local(o))}const first=choices.find(c=>c.ok&&c.id!=='later');setWhen(first?first.id:'later')},[open]);
 const chosen=choices.find(c=>c.id===when)!;
 const options=multi?opts.map(o=>o.trim()).filter(Boolean):[];
 const customLock=showCustom&&custom&&when!=='later'?new Date(custom).getTime():null;
 const closeAt=new Date(closes).getTime(),openAt=new Date(opens).getTime();
 const sealWhy=!sealed?'':!(closeAt>now+10*60000)?L('Picks need to close at least 10 minutes from now.','Seçimler en az 10 dakika sonra kapanmalı.'):!(openAt>=closeAt+86400000)?L('Open them at least a day after picks close.','Açılış, kapanıştan en az bir gün sonra olmalı.'):'';
 const valid=sealed?text.trim().length>=3&&(!multi||options.length>=2)&&(kind!=='friend'||canFriend)&&!sealWhy&&!!onSeal:text.trim().length>=3&&chosen.ok&&(!multi||options.length>=2)&&(kind!=='friend'||canFriend)&&(!customLock||(customLock>now&&(!deadline||customLock<=deadline)));
 async function submit(){
  if(sealed&&onSeal){const q=text.trim();const ok=await onSeal({kind:sealPreset?.kind||'own',title:q.length>60?q.slice(0,59)+'…':q,startsAt:new Date(closeAt).toISOString(),sealed:true,opensAt:new Date(openAt).toISOString(),calls:[{text:q,answerType:kind==='friend'?'friend':'choice',options:kind==='options'&&options.length?options:undefined}]});if(ok)onClose();return}
  const lock=customLock||chosen.lock;
  const ok=await onCreate({action:when==='later'?'longterm':'question',text:text.trim(),options:kind==='options'&&options.length?options:undefined,answerType:kind==='friend'?'friend':'choice',locksAt:new Date(lock).toISOString(),eventAt:chosen.event?new Date(chosen.event).toISOString():undefined,subjectId:subject||undefined,resolverId:settler||undefined});
  if(ok)onClose();
 }
 const badge=when==='later'?(practice?L('We’ll know in 30 min','30 dakikada belli olacak'):L('We’ll know in ','Belli olacağı ay: ')+(months.find(m=>m.index===month)||months[0])?.name):L('Picks close ','Kapanış: ')+new Date(customLock||chosen.lock).toLocaleString(L('en-GB','tr-TR'),{weekday:'short',hour:'2-digit',minute:'2-digit'});
 return <Sheet open={open} label={t("New call")} onClose={onClose} full>
  {first&&<p className="c-first">{t('Your group is ready. Ask the first one:')}</p>}
  <label className="c-big-label" htmlFor="call-text">{t('What’s the call?')}</label>
  <textarea id="call-text" className="c-question" rows={2} maxLength={240} value={text} onChange={e=>setText(e.target.value)} placeholder={EXAMPLES[lang][0]}/>
  {!text&&<div className="c-ideas">{(sealPreset?.kind==='year'?starters('year',lang).map(x=>x.text).slice(0,3):EXAMPLES[lang]).map(i=><button key={i} type="button" onClick={()=>{setText(i);if(canFriend)setKind('friend')}}>{i}</button>)}</div>}

  <span className="c-label">{t('Answers')}</span>
  <div className="c-seg three"><button type="button" className={kind==='friend'?'on':''} disabled={!canFriend} onClick={()=>setKind('friend')}>{t('A friend')}</button><button type="button" className={kind==='yesno'?'on':''} onClick={()=>setKind('yesno')}>{t('Yes / No')}</button><button type="button" className={kind==='options'?'on':''} onClick={()=>setKind('options')}>{t('Options')}</button></div>
  {kind==='friend'&&<div className="c-friend-preview">{friendNames.slice(0,10).map(n=><span key={n}><Face name={n} size={34}/><small>{n}</small></span>)}{friendNames.length>10&&<span><b>+{friendNames.length-10}</b></span>}</div>}
  {!canFriend&&<p className="c-hint">{t('Add friends in the Group tab to ask “who…?” calls.')}</p>}
  {multi&&<div className="c-opt-inputs">{opts.map((o,i)=><input key={i} aria-label={t('Option ')+(i+1)} maxLength={40} value={o} placeholder={['Aykut','Nagelsmann','Someone else','Nobody'][i]} onChange={e=>setOpts(opts.map((x,j)=>j===i?e.target.value:x))}/>)}{opts.length<4&&<button type="button" className="c-add" onClick={()=>setOpts([...opts,''])}>{t('+ Add')}</button>}</div>}

  <span className="c-label">{L('Results','Sonuçlar')}</span>
  <div className="c-seg c-mode"><button type="button" className={!sealed?'on':''} aria-pressed={!sealed} onClick={()=>setSealed(false)}>👀 {L('Live','Canlı')}</button><button type="button" className={sealed?'on':''} aria-pressed={sealed} onClick={()=>setSealed(true)}>🔒 {L('Sealed','Mühürlü')}</button></div>
  <p className="c-mode-note">{sealed?L('Nobody sees a thing until the day you open it together.','Birlikte açacağınız güne kadar kimse hiçbir şey göremez.'):L('Pick, then watch the group’s split as it comes in.','Seçimini yap, grubun nasıl bölündüğünü canlı izle.')}</p>
  {sealed?<div className="c-seal-dates">
   <label>{L('Picks close','Seçimler kapanır')}<input className="c-input c-date" type="datetime-local" value={closes} onChange={e=>setCloses(e.target.value)}/></label>
   <label>{L('Opens on','Açılış')}<input className="c-input c-date" type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)}/></label>
   {sealWhy&&<p className="c-hint warn">{sealWhy}</p>}
  </div>:<>
  <span className="c-label">{t('When will we know?')}</span>
  <div className="c-when">{choices.map(c=><button type="button" key={c.id} className={(when===c.id?'on':'')+(c.ok?'':' off')} aria-pressed={when===c.id} onClick={()=>setWhen(c.id)}><b>{c.label}</b><small>{c.sub}</small></button>)}</div>
  {when==='later'&&!practice&&<div className="c-months">{months.map(m=><button type="button" key={m.index} className={(month??months[0]?.index)===m.index?'on':''} onClick={()=>setMonth(m.index)}>{m.name}</button>)}</div>}
  {!chosen.ok?<p className="c-hint warn">{chosen.why||t('Not available right now. Try Later.')}</p>:choices.some(c=>!c.ok&&c.id!=='tonight')&&<p className="c-hint">{weeklyWhy}</p>}
  {when!=='later'&&chosen.ok&&<button type="button" className="c-link small" onClick={()=>setShowCustom(!showCustom)}>{showCustom?t('Use the suggested time'):t('Pick an exact time')}</button>}
  {showCustom&&when!=='later'&&<input className="c-input c-date" type="datetime-local" aria-label={t("Picks close at")} value={custom} onChange={e=>setCustom(e.target.value)}/>}
  </>}

  {!sealed&&members.length>0&&<><span className="c-label">{t('About someone?')} <small>{t('They’ll see the call, but not anyone’s answers until it’s settled.')}</small></span><div className="c-about">{members.map(m=><button type="button" key={m.id} className={subject===m.id?'on':''} aria-pressed={subject===m.id} onClick={()=>setSubject(subject===m.id?'':m.id)}><Face name={m.name} size={26}/>{m.name}</button>)}</div></>}

  {!sealed&&members.length>0&&<><span className="c-label">{t('Who says what happened?')} <small>{t('You, unless you pick someone who’ll be there.')}</small></span><div className="c-about"><button type="button" className={!settler?'on':''} aria-pressed={!settler} onClick={()=>setSettler('')}>{t('You')}</button>{members.map(m=><button type="button" key={m.id} className={settler===m.id?'on':''} aria-pressed={settler===m.id} onClick={()=>setSettler(m.id)}><Face name={m.name} size={26}/>{m.name}</button>)}</div></>}

  <div className="c-sheet-foot"><span className={'c-badge '+(sealed||when==='later'?'later':'soon')}>{sealed?'🔒 '+L('Opens ','Açılış ')+(openAt?new Date(openAt).toLocaleDateString(L('en-GB','tr-TR'),{day:'numeric',month:'short',year:'numeric'}):''):badge}</span>
  <button className="c-btn" disabled={!valid||busy} onClick={submit}>{t('Post it')} <Icon name="arrow"/></button></div>
 </Sheet>;
}
