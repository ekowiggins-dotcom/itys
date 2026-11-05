'use client';
import {t,L} from './i18n';
// Moments: a birthday, a trip, a night out. A few calls that close together, one table, one card at the end.
import {useEffect,useMemo,useState} from 'react';
import {Sheet,Face,Faces,Icon,Badge,Split} from './ui';
import {type Call,type Moment,type Snapshot,answersOf,label,momentView,momentLeaders,reveal} from './calls';
import {countdown,when} from './format';
import {starters,MOMENT_KINDS,type MomentKind} from '../lib/moment-starters';

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

type Draft={text:string;answerType:'friend'|'choice';options?:string[];on:boolean;idea?:boolean};
export type NewMoment={kind:MomentKind;title:string;subject?:string;startsAt:string;sealed?:boolean;opensAt?:string;calls:{text:string;answerType:'friend'|'choice';options?:string[]}[]};

/** Start a Moment: the occasion, one or two details, three suggested calls. */
export function NewMomentSheet({open,now,lang,friends,busy,preset,onCreate,onClose}:{open:boolean;now:number;lang:Lang;friends:string[];busy:boolean;preset?:MomentKind;onCreate:(m:NewMoment)=>Promise<boolean>;onClose:()=>void}){
 const [sealed,setSealed]=useState(false),[opensOn,setOpensOn]=useState('');
 const [ideas,setIdeas]=useState(false),[kind,setKind]=useState<MomentKind>('own'),[who,setWho]=useState(''),[place,setPlace]=useState(''),[typed,setTyped]=useState(''),[start,setStart]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[extra,setExtra]=useState('');
 useEffect(()=>{if(open){setKind(preset||'own');setIdeas(!!preset&&preset!=='own');setWho('');setPlace('');setTyped('');setStart(defaultStart(now));setDrafts([]);setExtra('');setSealed(false);setOpensOn('')}},[open]);
 // The year ahead is sealed by default: seal on New Year's Eve, open on the next one. A birthday can be sealed until the next birthday.
 useEffect(()=>{if(kind==='year'){const d=yearDates(now);setSealed(true);setStart(d.seal);setOpensOn(d.open)}else if(sealed&&!opensOn&&start){setOpensOn(local(new Date(new Date(start).getTime()+365*86400000)))}},[kind]);
 useEffect(()=>{const ex=kind==='own'?[]:starters(kind,lang,who).map(s=>({...s,on:true,idea:true}));setDrafts(d=>[...ex,...d.filter(x=>!x.idea)])},[kind,who,lang]);
 const addExtra=()=>{const q=extra.trim();if(q.length<3)return;const friend=/^(who|kim)\b|\bkim\b/i.test(q)&&friends.length>=2;setDrafts([...drafts,{text:q,answerType:friend?'friend':'choice',on:true}]);setExtra('')};
 if(!open)return null;
 const k=KIND[kind],auto=k.titled?'':autoTitle(kind,lang,who,place,typed),title=typed.trim()||auto;
 const chosen=drafts.filter(d=>d.on&&d.text.trim().length>=3);
 const startMs=start?new Date(start).getTime():0,needsFriends=chosen.some(d=>d.answerType==='friend')&&friends.length<2;
 const opensMs=sealed&&opensOn?new Date(opensOn).getTime():0;
 const valid=title.trim().length>=2&&(!k?.who||!!who)&&startMs>now+10*60000&&chosen.length>0&&!needsFriends&&(!sealed||opensMs>=startMs+86400000);
 return <Sheet open label={t("New Moment")} onClose={onClose} full>
  <span className="c-kicker dark">{t('New Moment')}</span>
  <h2 className="c-title">{t('What’s happening?')}</h2>
  <label className="c-field">{t('Call it')}<input className="c-input" value={typed} onChange={e=>setTyped(e.target.value)} maxLength={60} placeholder={auto||(lang==='tr'?t('Ece’nin doğum günü, Kaş tatili…'):t('Ece’s birthday, the Rome trip…'))}/></label>
  <button type="button" className="c-ideas-toggle" aria-expanded={ideas} onClick={()=>setIdeas(!ideas)}>💡 {ideas?t('Hide ideas'):t('Need ideas?')}</button>
  {ideas&&<div className="c-idea-chips">{MOMENT_KINDS.filter(id=>id!=='own'&&(id!=='year'||kind==='year')).map(id=><button key={id} type="button" className={kind===id?'on':''} aria-pressed={kind===id} onClick={()=>setKind(kind===id?'own':id)}><span aria-hidden="true">{KIND[id].emoji}</span>{lang==='tr'?KIND[id].tr:KIND[id].en}</button>)}</div>}
  {k.who&&<><span className="c-label">{kind==='birthday'?t('Whose birthday?'):kind==='wedding'?t('Whose wedding?'):kind==='baby'?t('Whose baby?'):t('Who’s starting?')}</span><div className="c-about">{friends.map(n=><button type="button" key={n} className={who===n?'on':''} aria-pressed={who===n} onClick={()=>setWho(n)}><Face name={n} size={26}/>{n}</button>)}</div></>}
  {k.place&&<label className="c-field">{t('Where to?')}<input className="c-input" value={place} onChange={e=>setPlace(e.target.value)} maxLength={40} placeholder={lang==='tr'?t('Kaş, Roma, kamp…'):t('Rome, the coast, camping…')}/></label>}
   <label className="c-check c-seal"><input type="checkbox" checked={sealed} onChange={e=>{setSealed(e.target.checked);if(e.target.checked&&!opensOn&&start)setOpensOn(local(new Date(new Date(start).getTime()+365*86400000)))}}/><span><b>{t('🔒 Seal it')}</b><small>{t('Nobody sees any answers, not even the split, until the opening date. Then you open them together. Anyone can add predictions until it’s sealed.')}</small></span></label>
   <label className="c-field">{sealed?t('Seal date'):t('When does it start?')}<input className="c-input" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/><small>{sealed?t('Picks and new predictions close then.'):t('Picks close then.')}</small></label>
   {sealed&&<label className="c-field">{t('Opens on')}<input className="c-input" type="datetime-local" value={opensOn} onChange={e=>setOpensOn(e.target.value)}/><small>{t('Everyone gets the same push, and you open them one by one.')}</small></label>}
   <span className="c-label">{t('Your calls')} <small>{drafts.some(d=>d.idea)?t('Keep, edit or untick the ideas. Up to 8.'):t('What should the group predict? Up to 8.')}</small></span>
   <div className="c-drafts">{drafts.map((d,i)=><div key={i} className={'c-draft'+(d.on?'':' off')}>
    <button type="button" className="c-tick" aria-pressed={d.on} aria-label={d.on?t('Remove this call'):t('Keep this call')} onClick={()=>setDrafts(drafts.map((x,j)=>j===i?{...x,on:!x.on}:x))}>{d.on&&<Icon name="check" size={16} stroke={3}/>}</button>
    <div className="c-draft-main"><textarea rows={2} maxLength={240} value={d.text} onChange={e=>setDrafts(drafts.map((x,j)=>j===i?{...x,text:e.target.value}:x))} aria-label={t('Call ')+(i+1)}/>
     <small>{d.answerType==='friend'?t('Pick a friend'):d.options?.length?d.options.join(' · '):t('Yes / No')}</small></div></div>)}
    {drafts.length<8&&<div className="c-draft add"><input className="c-input" value={extra} onChange={e=>setExtra(e.target.value)} maxLength={240} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addExtra()}}} placeholder={drafts.length?t('+ Add another'):(lang==='tr'?t('Örn. Kim ilk sarhoş olur?'):t('e.g. Who gets lost first?'))}/>
     <button type="button" className="c-btn small" disabled={extra.trim().length<3} onClick={addExtra}>{t('Add')}</button></div>}
   </div>
   {!drafts.length&&<p className="c-hint">{t('A “who…?” question lets everyone pick a friend; anything else is yes or no.')}</p>}
   {needsFriends&&<p className="c-hint warn">{t('Add friends in the Group tab first, for “who…?” calls.')}</p>}
   <div className="c-sheet-foot"><span className="c-badge later">{title||'…'}{sealed&&opensMs?t(' · opens ')+new Date(opensMs).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):startMs?' · '+when(new Date(startMs).toISOString(),now):''}</span>
    <button className="c-btn" disabled={!valid||busy} onClick={async()=>{if(await onCreate({kind,title:title.trim(),subject:who||undefined,startsAt:new Date(startMs).toISOString(),sealed:sealed||undefined,opensAt:sealed?new Date(opensMs).toISOString():undefined,calls:chosen.slice(0,8).map(d=>({text:d.text.trim(),answerType:d.answerType,options:d.options}))}))onClose()}}>{t('Create & share')} <Icon name="arrow"/></button></div>
 </Sheet>;
}

const days=(to:string,now:number)=>Math.max(0,Math.ceil((Date.parse(to)-now)/86400000));
const dateLabel=(d:string)=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
/** "Seal yours by 31 Dec" · "Opens in 412 days" · "Open it!" */
function sealBadge(m:Moment,status:string,now:number){if(status==='open')return L('Seal yours by ','Son mühür: ')+dateLabel(m.starts_at);if(status==='sealed'){const d=days(m.opens_at!,now);return d<=1?L('Opens in ','Açılışa ')+countdown(m.opens_at!,now):L('Opens in '+d+' days',d+' gün sonra açılıyor')}return status==='done'?t('All settled'):L('Open it!','Aç!')}

/** The Moment at the top of the Calls tab. */
export function MomentCard({m,calls,me,names,now,lang,onOpen,onPick}:{m:Moment;calls:Call[];me?:string;names:Record<string,string>;now:number;lang:Lang;onOpen:()=>void;onPick:()=>void}){
 const v=momentView(m,calls,now,me),k=KIND[m.kind as MomentKind]||KIND.own;
 const pickers=[...new Set(v.calls.flatMap(c=>c.picker_ids||[]))].map(id=>names[id]).filter(Boolean);
 return <article className={'c-moment '+v.status+(m.sealed?' capsule':'')} onClick={onOpen}>
  <div className="c-moment-top"><span className="c-moment-emoji" aria-hidden="true">{m.sealed&&v.status==='sealed'?'🔒':k.emoji}</span><div className="c-moment-id"><h3>{m.title}</h3><p>{v.calls.length} {L(v.calls.length===1?'call':'calls','tahmin')}{pickers.length?' · '+pickers.length+L(' in',' kişi'):''}{v.status==='live'&&v.settled?' · '+v.settled+L(' settled',' sonuçlandı'):''}</p></div><Badge tone={v.status==='open'?(Date.parse(m.starts_at)-now<6*3600000?'soon':'neutral'):'later'}>{m.sealed?sealBadge(m,v.status,now):v.status==='open'?(Date.parse(m.starts_at)-now<6*3600000?t('Starts in ')+countdown(m.starts_at,now):when(m.starts_at,now)):v.status==='live'?t('Happening now'):t('All settled')}</Badge></div>
  <div className="c-moment-foot"><Faces names={pickers} size={24}/>{v.status==='open'&&v.toPick.length>0?<button className="c-btn small" onClick={e=>{e.stopPropagation();onPick()}}>{v.toPick.length===v.calls.length?t('Make your picks'):v.toPick.length+L(' left to pick',' seçim kaldı')}</button>:<span className="c-link">{v.status==='done'?t('See who called it'):m.sealed&&v.status==='live'?t('Open them'):t('Open')} <Icon name="arrow" size={16}/></span>}</div>
 </article>;
}

/** A Moment's own page: its calls, the table, the result. */
export function MomentSheet({m,calls,snaps,me,meName,names,now,lang,friends=[],busy=false,onClose,onPick,onReveal,onResolve,onResult,onShare,onAdd,onCeremony,canSet}:{m:Moment|null;calls:Call[];snaps:Snapshot[];me?:string;meName?:string;names:Record<string,string>;now:number;lang:Lang;friends?:string[];busy?:boolean;onClose:()=>void;onPick:(c?:Call)=>void;onReveal:(c:Call)=>void;onResolve:(c:Call)=>void;onResult:(c:Call)=>void;onShare:()=>void;onAdd?:(c:{text:string;answerType:'friend'|'choice'})=>Promise<boolean>;onCeremony?:()=>void;canSet:(c:Call)=>boolean}){
 const [draft,setDraft]=useState('');
 const v=useMemo(()=>m?momentView(m,calls,now,me):null,[m,calls,now,me]);
 const leaders=useMemo(()=>v?momentLeaders(v.calls,snaps):[],[v,snaps]);
 if(!m||!v)return null;
 const k=KIND[m.kind as MomentKind]||KIND.own,top=leaders[0],tied=top?leaders.filter(l=>l.points===top.points&&l.right===top.right):[];
 const kindName=(m.kind==='own'?'moment':m.kind==='job'?'new start':k.en).toLowerCase();
 return <Sheet open label={m.title} onClose={onClose} full>
  <div className="c-moment-head"><span className="c-moment-emoji big" aria-hidden="true">{k.emoji}</span><div><span className="c-kicker dark">{m.sealed?(v.status==='open'?t('Seal yours by ')+dateLabel(m.starts_at)+t(' · opens ')+dateLabel(m.opens_at!):v.status==='sealed'?t('🔒 Sealed · opens ')+dateLabel(m.opens_at!)+' ('+sealBadge(m,v.status,now).replace('Opens ','')+')':v.status==='live'?t('Opened ')+dateLabel(m.opens_at!):t('All settled')):v.status==='open'?t('Picks close ')+when(m.starts_at,now):v.status==='live'?t('Happening now'):t('All settled')}</span><h2 className="c-title">{m.title}</h2></div></div>
  {v.status==='open'&&v.toPick.length>0&&<button className="c-btn" onClick={()=>onPick()}>{m.sealed?(v.toPick.length===v.calls.length?t('Seal your picks'):t('Seal the last ')+v.toPick.length):v.toPick.length===v.calls.length?t('Make your picks'):t('Pick the last ')+v.toPick.length} <Icon name="arrow"/></button>}
  {m.sealed&&v.status==='sealed'&&<div className="c-sealed-note"><span aria-hidden="true">🔒</span><p>{t('Nobody can see any answers until')} {dateLabel(m.opens_at!)}{t(', not even how the group split. Then everyone opens them together.')}</p></div>}
  {m.sealed&&v.status==='live'&&onCeremony&&<button className="c-btn" onClick={onCeremony}>{t('Open them one by one')} <Icon name="arrow"/></button>}
  {top&&<section className={'c-oracle'+(v.status==='done'?' done':'')}><span className="c-kicker dark">{v.status==='done'?t('Oracle of the ')+kindName:t('Leading so far')}</span>
   <div className="c-oracle-who"><Faces names={tied.map(t=>t.name)} size={44} ring="#17201B"/><b>{tied.map(t=>t.name===meName?'You':t.name).join(' & ')}</b><span>{top.right} of {v.settled} right</span></div>
   {leaders.length>1&&<ol className="c-oracle-list">{leaders.slice(0,6).map(l=><li key={l.name}><Face name={l.name} size={22}/>{l.name===meName?t('You'):l.name}<span className="c-n">{l.right}/{v.settled}</span></li>)}</ol>}
  </section>}
  <div className="c-moment-calls">{v.calls.map((c,i)=>{const open=c.state==='open'&&now<Date.parse(c.locks_at),settled=c.state==='settled',isVoid=c.state==='void';
   return <div key={c.id} className="c-mcall">
    <span className="c-mcall-n">{i+1}</span>
    <div className="c-mcall-main"><b>{c.text}</b>
     {settled?<small className={c.answer&&c.answer===c.result_answer?'win':''}>{label(c.result_answer||'',c)} it was{c.answer?t(' · you said ')+label(c.answer,c):''}</small>
     :isVoid?<small>{t('Called off')}</small>
     :c.answer?<small>{t('You said')} {label(c.answer,c)}</small>:<small>{open?t('Not picked yet'):t('You didn’t pick')}</small>}
     {c.split&&!settled&&<Split answers={answersOf(c)} counts={c.split} mine={c.answer} label={a=>label(a,c)} compact/>}
    </div>
    <div className="c-mcall-act">{open?<button className="c-chip" onClick={()=>onPick(c)}>{c.answer?t('Change'):t('Pick')}</button>
     :settled?<button className="c-chip" onClick={()=>onResult(c)}>{t('See')}</button>
     :v.status==='sealed'?<span className="c-lock" aria-label={t("Sealed")}>🔒</span>
     :c.state==='open'&&canSet(c)?<button className="c-chip dark" onClick={()=>onResolve(c)}>{t('What happened?')}</button>
     :!isVoid?<button className="c-chip" onClick={()=>onReveal(c)}>{t('Who said what')}</button>:null}</div>
   </div>})}</div>
  {m.sealed&&v.status==='open'&&onAdd&&<div className="c-draft add"><input className="c-input" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={240} placeholder={t("+ Add a prediction for everyone")}/><button type="button" className="c-btn small" disabled={busy||draft.trim().length<3} onClick={async()=>{const q=draft.trim();if(await onAdd({text:q,answerType:/^(who|kim)\b|\bkim\b/i.test(q)&&friends.length>=2?'friend':'choice'}))setDraft('')}}>{t('Add')}</button></div>}
  <button className="c-btn ghost" onClick={onShare}><Icon name="share"/> {v.status==='done'?t('Share the result'):t('Send to the group')}</button>
 </Sheet>;
}

/** Group tab: the group's Moments so far. Its shared memory. */
export function PastMoments({moments,calls,snaps,now,meName,onOpen}:{moments:Moment[];calls:Call[];snaps:Snapshot[];now:number;meName?:string;onOpen:(m:Moment)=>void}){
 const past=moments.filter(m=>momentView(m,calls,now).status==='done');
 if(!past.length)return null;
 return <section className="c-card past"><span className="c-kicker dark">{t('Past Moments')}</span><div className="c-past">{past.map(m=>{const v=momentView(m,calls,now),l=momentLeaders(v.calls,snaps),top=l[0];const k=KIND[m.kind as MomentKind]||KIND.own;
  return <button key={m.id} className="c-past-row" onClick={()=>onOpen(m)}><span className="c-moment-emoji" aria-hidden="true">{k.emoji}</span><span className="c-past-main"><b>{m.title}</b><small>{new Date(m.starts_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}{top?' · '+(top.name===meName?t('You'):top.name)+' called '+top.right+'/'+v.settled:''}</small></span><Icon name="arrow" size={16}/></button>})}</div></section>;
}

/** Opening day: one prediction at a time, tap to see who said what, then say what happened. */
export function OpeningSheet({m,calls,snaps,meName,now,onResolve,onClose}:{m:Moment|null;calls:Call[];snaps:Snapshot[];meName?:string;now:number;onResolve:(c:Call)=>void;onClose:()=>void}){
 const [i,setI]=useState(0),[shown,setShown]=useState(false);
 useEffect(()=>{setI(0);setShown(false)},[m?.id]);
 if(!m)return null;
 const list=momentView(m,calls,now).calls,c=list[Math.min(i,list.length-1)];if(!c)return null;
 const groups=reveal(c,snaps).filter(g=>g.names.length).sort((a,b)=>b.names.length-a.names.length),total=groups.reduce((n,g)=>n+g.names.length,0);
 const last=i>=list.length-1;
 return <Sheet open dark full label={t("Opening")} onClose={onClose}>
  <div className="c-open-top"><span className="c-kicker">{m.title}</span><span className="c-open-count">{i+1} / {list.length}</span></div>
  <div className="c-steps c-open-steps" aria-hidden="true">{list.map((_,k)=><i key={k} className={k<i?'done':k===i?'now':''}/>)}</div>
  <h2 className="c-title big">{c.text}</h2>
  {!shown?<button className="c-reveal-btn" onClick={()=>setShown(true)}><span aria-hidden="true">🔓</span>{t('Tap to see what everyone said')}</button>
  :<><div className="c-reveal">{groups.length?groups.map(g=>{const mine=g.names.some(n=>n.name===meName);return <div key={g.answer} className={'c-group'+(mine?' mine':'')}>
    <div className="c-group-head"><b>{label(g.answer,c)}</b><span>{g.names.length} {g.names.length===1?'friend':'friends'}</span></div>
    <div className="c-names">{g.names.map(n=><span key={n.name}><Face name={n.name} size={26}/>{n.name===meName?t('You'):n.name}</span>)}</div></div>}):<p className="c-sub light">{t('Nobody sealed an answer for this one.')}</p>}</div>
   {c.state==='settled'?<p className="c-sub light"><b>{label(c.result_answer||'',c)}</b> {t('it was.')} {total?groups.find(g=>g.answer===c.result_answer)?.names.length||0:0} of {total} {t('saw it coming.')}</p>
   :c.state==='proposed'?<p className="c-sub light">{t('Someone said:')} <b>{label(c.proposed_answer||'',c)}</b>{t('. Counts in a day unless someone says it’s not right.')}</p>
   :c.state==='open'?<button className="c-btn" onClick={()=>onResolve(c)}>{t('What happened?')}</button>:null}</>}
  <div className="c-open-nav">{i>0&&<button className="c-link light" onClick={()=>{setI(i-1);setShown(true)}}>{t('Back')}</button>}<button className="c-btn dark-lime" onClick={()=>{if(last)onClose();else{setI(i+1);setShown(false)}}}>{last?t('Done'):t('Next prediction')} <Icon name="arrow"/></button></div>
 </Sheet>;
}
