'use client';
import {useEffect,useState,useRef} from 'react';
import LifecyclePanel, {type LifecycleData} from './LifecyclePanel';
import WeeklyBoard, {type WeeklyRound} from './WeeklyBoard';
import SharePanel from './SharePanel';
import FootballPanel,{FootballPick,marketLabel,type FootballQuestion,type FootballData} from './Football';
import {slotLimits,period} from '../lib/football/rules';
import {betCard,shareLink,winnerCard} from '../lib/sharing';
import {when,countdown,answerLabel} from './format';
import TimeChips,{weeklyPresets,practicePresets} from './TimeChips';
import HowItWorks from './HowItWorks';
import {BRAND,BRAND_NAME} from '../lib/brand';
import {api,webOrigin,setSession,lastInvite,rememberInvite,NATIVE} from './api-client';
import {initNative,haptic,updateWidget} from './native';
type Question=FootballQuestion;
type Preview={id:string;text:string;options:string[]|null;locks_at:string;scope:string;state:string;picked:number};
type GroupView=LifecycleData & FootballData & {timing?:{practice:boolean;disputeMs:number;resolutionMs:number};group:{name:string;opens_at?:string;practice?:boolean};members:number;joined:boolean;user?:{name:string};questions:Question[];used:number;rounds?:WeeklyRound[];selectedRound?:WeeklyRound;currentRoundId?:string;suggestions?:unknown[];preview?:Preview|null};
type Tab='round'|'ranking'|'open'|'group';
const TABS:{id:Tab;label:string;icon:string}[]=[{id:'round',label:'Round',icon:'M4 6h16M4 12h16M4 18h10'},{id:'ranking',label:'Ranking',icon:'M6 20V10M12 20V4M18 20v-7'},{id:'open',label:'Long-term',icon:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'},{id:'group',label:'Group',icon:'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8'}];

export default function Home(){
 const [invite,setInvite]=useState(''),[data,setData]=useState<GroupView|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[create,setCreate]=useState(false);
 const [notificationFocus,setNotificationFocus]=useState(0);const [featureFocus,setFeatureFocus]=useState({name:'',tick:0});
 const [tab,setTab]=useState<Tab>('round');const [practiceAllowed,setPracticeAllowed]=useState(false);const [boardRound,setBoardRound]=useState('');
 const requestId=useRef('');const selectedRound=useRef('');const [template,setTemplate]=useState('');const [origin,setOrigin]=useState('');const [createdQuestion,setCreatedQuestion]=useState('');const [focusQuestion,setFocusQuestion]=useState('');const focused=useRef('');
 async function load(code:string){const q=new URLSearchParams(location.search).get('question');const r=await api('/api?invite='+encodeURIComponent(code)+(selectedRound.current?'&round='+encodeURIComponent(selectedRound.current):'')+(q?'&question='+encodeURIComponent(q):''));const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);void rememberInvite(code);}
 useEffect(()=>{void api('/api?config').then(r=>r.json()).then(c=>setPracticeAllowed(!!c.practiceAllowed)).catch(()=>{})},[]);
 useEffect(()=>{setOrigin(webOrigin());void (async()=>{const params=new URLSearchParams(location.search);setFocusQuestion(params.get('question')||'');if(params.get('view')==='winner')setTab('ranking');const code=params.get('invite')||(await lastInvite())||'';selectedRound.current=params.get('round')||'';setInvite(code);if(code)await load(code).catch(e=>setError(e.message));setLoading(false);if(NATIVE)void initNative({onOpen:url=>{const u=new URL(url);if(u.searchParams.get('invite'))location.href='/'+u.search}});})()},[]);
 async function act(payload:Record<string,unknown>,quiet=false){setError('');setNotice('');setBusy(true);try{const r=await api('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,invite})});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.session)await setSession(d.session);if(payload.action==='predict'||payload.action==='predictLongterm')void haptic('pick');if(NATIVE&&(payload.action==='join'||payload.action==='create'))void initNative({register:true});if(d.focusTab)setFeatureFocus(v=>({name:d.focusTab,tick:v.tick+1}));if(d.invite){setInvite(d.invite);const nextUrl=new URL(location.href);nextUrl.searchParams.set('invite',d.invite);if(selectedRound.current)nextUrl.searchParams.set('round',selectedRound.current);history.replaceState(null,'',nextUrl);await load(d.invite);}if(payload.action==='question'&&d.questionId)setCreatedQuestion(d.questionId);if(!quiet)setNotice(payload.action==='predict'?'Pick saved. You can change it until it locks.':payload.action==='question'?'Call added. Share it with the group.':payload.action==='leave'?'You left. Your locked picks and round record stay.':payload.action==='join'||payload.action==='create'?'You’re in. Let’s make it interesting.':'Saved.');return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
 useEffect(()=>{if(!invite)return;const timer=setInterval(()=>{void load(invite).catch(()=>{})},15000);return ()=>clearInterval(timer)},[invite]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return ()=>clearTimeout(t)},[notice]);
 function submitForm(e:React.FormEvent<HTMLFormElement>,action:string){e.preventDefault();const f=new FormData(e.currentTarget);const payload:Record<string,unknown>={action,...Object.fromEntries(f.entries())};if(action==='question'){requestId.current ||= crypto.randomUUID();payload.requestId=requestId.current;}if(payload.subjectId==='')delete payload.subjectId;if(action==='question'){const opts=f.getAll('option').map(o=>String(o).trim()).filter(Boolean);delete payload.option;if(opts.length)payload.options=opts;}if(action==='create'){payload.practice=payload.practice==='1';if(payload.practice)delete payload.groupType;try{payload.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}const region=navigator.languages?.map(l=>l.split('-')[1]).find(r=>r&&/^[A-Za-z]{2}$/.test(r));if(region)payload.country=region.toUpperCase();}if(payload.locksAt)payload.locksAt=new Date(payload.locksAt as string).toISOString();void act(payload).then(ok=>{if(ok){setCreate(false);requestId.current='';}});}
 async function joinAndPick(name:string,answer:string,stake:number,questionId:string,scope:string){const joined=await act({action:'join',name},true);if(!joined)return;if(!answer){setNotice('You’re in. Let’s make it interesting.');return;}const ok=await act(scope==='longterm'?{action:'predictLongterm',questionId,answer}:{action:'predict',questionId,answer,stake},true);setNotice(ok?'You’re in, and your pick is saved.':'You’re in. That call can’t take picks right now.');}
 async function copy(){try{await navigator.clipboard.writeText(shareLink(webOrigin(),invite));setNotice('Invite link copied.');}catch{setNotice('Copy the address from your browser to invite friends.');}}
 useEffect(()=>{if(!data?.joined||!focusQuestion)return;const b=data.bets?.find(b=>b.id===focusQuestion);if(b?.scope==='longterm')setTab('open');else setTab('round')},[data?.joined,focusQuestion]);
 useEffect(()=>{if(!data?.joined||!focusQuestion)return;const target='bet-'+focusQuestion;if(focused.current===target)return;const t=setTimeout(()=>{const el=document.getElementById(target);if(el){focused.current=target;el.scrollIntoView({behavior:'smooth',block:'center'});el.focus({preventScroll:true});}},150);return ()=>clearTimeout(t)},[data?.joined,tab,focusQuestion]);
 function go(t:Tab){setTab(t);window.scrollTo({top:0});void haptic('tap');}
 // Keep the home-screen widget current, and celebrate a weekly win once (app only).
 useEffect(()=>{if(!NATIVE||!data?.joined||!data.user)return;const me=(data as {user?:{id?:string}}).user?.id;const live=data.selectedRound?.standings.find(s=>s.user_id===me);const final=(data.rounds||[]).find(r=>r.state==='final');const mine=live&&live.points_tenths>0?live:final?.standings.find(s=>s.user_id===me);
  const open=(data.questions||[]).filter(q=>Date.parse(q.locks_at)>Date.now());const next=open.map(q=>Date.parse(q.locks_at)).sort((a,b)=>a-b)[0];
  void updateWidget({group:data.group.name,rank:mine?.rank??null,members:data.members,points:mine?mine.points_tenths/10:null,toGo:open.filter(q=>!q.answer).length,nextLockAt:next?new Date(next).toISOString():null,updatedAt:new Date().toISOString(),invite});
  if(final&&final.winners.some(w=>w.user_id===me)){const k='sidebet.celebrated.'+final.id;try{if(!localStorage.getItem(k)){localStorage.setItem(k,'1');void haptic('win')}}catch{}}
 },[data,invite]);

 const clock=data?.demoNow||Date.now();
 const start=data?.group.opens_at?new Date(data.group.opens_at):null;
 const roundType=data?.selectedRound?.group_type||data?.group.group_type||'Friends',limits=slotLimits(roundType),zone=data?.selectedRound?.timezone||data?.group.timezone||'UTC',customUsed=data?.questions.filter(q=>(q.market||'custom')==='custom').length||0;
 const football=roundType!=='Friends';
 const canPickFootball=!!data?.selectedRound&&['live','provisional'].includes(data.selectedRound.state)&&data.selectedRound.content_ready!==false&&clock<=Date.parse(data.selectedRound.pick_end_at||'');
 const active=!!start&&clock>=start.getTime()&&(!data?.selectedRound||(data.selectedRound.state==='live'&&data.selectedRound.content_ready!==false&&data.currentRoundId===data.selectedRound.id));
 const createClosed=!active||customUsed>=limits.custom||(!!start&&clock>period(start,roundType,zone,!!data?.group.practice).customCutoff.getTime());
 const unread=data?.notifications?.filter(n=>!n.read_at).length||0;
 const openQs=(data?.questions||[]).filter(q=>(q.market||'custom')!=='custom'||clock<Date.parse(q.locks_at));
 const nextLock=openQs.map(q=>Date.parse(q.locks_at)).filter(t=>t>clock).sort((a,b)=>a-b)[0];
 const byLock=(a:Question,b:Question)=>Date.parse(a.locks_at)-Date.parse(b.locks_at);
 const todo=openQs.filter(q=>!q.answer).sort(byLock),picked=openQs.filter(q=>q.answer).sort(byLock);
 const lastFinal=(data?.rounds||[]).find(r=>r.state==='final'&&r.winners.length>0);
 const liveEmpty=!!data?.selectedRound&&data.selectedRound.state!=='final'&&data.selectedRound.standings.every(x=>x.points_tenths===0);
 const board=(data?.rounds||[]).find(r=>r.id===boardRound)||(liveEmpty&&lastFinal?lastFinal:data?.selectedRound);

 if(loading)return <main className="app"><p className="loading" role="status">Opening your group…</p></main>;

 // Landing: create a group.
 if(!invite)return <><header className="site"><a className="brand" href="/">{BRAND}<span>↗</span></a><span className="pill">Free. No money. Ever.</span></header><main className="landing">
  <span className="eyebrow">THE GROUP CHAT HAS A SCOREBOARD NOW</span><h1>Big opinions.<br/><em>Zero money.</em></h1><p>Every week, your friends make calls on football and on each other. Points are free and can’t be bought or cashed out. Bragging rights are earned.</p>
  <section className="panel"><h2>Start your group</h2><form onSubmit={e=>submitForm(e,'create')}>{practiceAllowed&&<label className="practice-toggle"><input type="checkbox" name="practice" value="1"/><span><b>Practice group</b><small>For testing: a new round every hour, results settle in minutes.</small></span></label>}<label>Your name<input name="name" required maxLength={60} placeholder="What do your friends call you?" autoComplete="given-name"/></label><label>Group name<input name="groupName" required maxLength={60} placeholder="The usual suspects"/></label><label>What will you predict?<select name="groupType" defaultValue="Friends"><option value="Friends">Friends · our own calls</option><option value="Football">Football · weekly match picks</option><option value="Mixed">Mixed · football + our own calls</option></select></label><button disabled={busy}>Create group <span>↗</span></button></form><small>Competition starts once three friends join. For players aged 18 and over.</small></section>
  {error&&<p className="toast error" role="alert">{error}</p>}
 </main></>;

 if(!data)return <main className="app">{error&&<p className="toast error" role="alert">{error}</p>}</main>;

 // Invite link, not joined yet: show the shared bet first.
 if(!data.joined)return <main className="app join-screen"><a className="brand small" href="/">{BRAND}<span>↗</span></a>
  <span className="eyebrow">YOU’RE INVITED TO</span><h1 className="group-name">{data.group.name}</h1><p className="muted">{data.members} friends · free points, no money</p>
  {data.preview?<JoinWithPick preview={data.preview} busy={busy} clock={clock} onJoin={joinAndPick}/>:<section className="card"><h2>A name. An opinion. You’re in.</h2><form onSubmit={e=>submitForm(e,'join')}>{!data.user&&<label>Your name<input name="name" required maxLength={60} placeholder="Your name" autoComplete="given-name"/></label>}<button disabled={busy}>Join the group ↗</button></form><small>Free points only. For players aged 18 and over.</small></section>}
  {error&&<p className="toast error" role="alert">{error}</p>}{notice&&<p className="toast" role="status">{notice}</p>}
 </main>;

 const status=data.members<3?'Waiting for '+(3-data.members)+' more':!active?(start&&clock<start.getTime()?'Opens '+when(start,clock,zone):'Round closed'):nextLock?'Next lock in '+countdown(nextLock,clock):data.questions.length?'All picks locked':'Round open · add the first call';

 return <div className="app-shell">
  <header className="app-top"><div className="top-row"><div><span className="top-kicker">{data.group.practice?<b className="practice-badge">Practice · rounds every hour</b>:<>{roundType} · {data.members} friends</>}</span><h1 className="group-name">{data.group.name}</h1></div><div className="points" aria-label="Confidence points left"><strong>{100-data.used}</strong><span>of 100 pts</span></div></div>
   <div className="meter" aria-hidden="true"><div style={{width:(100-data.used)+'%'}}/></div><p className="status-line"><span className={'dot '+(active?'live':'')}/>{status}</p></header>

  <main className="app">
  {tab==='round'&&<>
   {data.members<3&&<section className="card invite-card"><h2>Good calls need good company.</h2><p>Invite {3-data.members} more {data.members===2?'friend':'friends'} to start your first round.</p><button onClick={copy}>Copy invite link ↗</button></section>}
   {limits.custom>0&&data.members>=3&&<button className="add-bet" disabled={createClosed} onClick={()=>setCreate(!create)}>{customUsed>=limits.custom?'All '+limits.custom+' calls used':create?'Close':'+ Add a call'}<small>{limits.custom-customUsed} of {limits.custom} left</small></button>}
   {create&&<section className="card creation"><h2>New call</h2><form onSubmit={e=>submitForm(e,'question')}><label>Question<input name="text" defaultValue={template} minLength={3} maxLength={240} required placeholder="Will Alex be late on Saturday?"/></label><fieldset className="options"><legend>Answers <small>· empty = Yes / No</small></legend>{[1,2,3,4].map(n=><input key={n} name="option" maxLength={40} placeholder={'Option '+n}/>)}</fieldset><TimeChips name="locksAt" label="Picks close" now={clock} max={data.selectedRound?Date.parse(data.selectedRound.deadline_at):undefined} presets={(data.group.practice?practicePresets:weeklyPresets)(clock,data.selectedRound?Date.parse(data.selectedRound.deadline_at):clock+3*86400000)}/><label>About someone? <small>(they can’t pick)</small><select name="subjectId"><option value="">Nobody</option>{data.groupMembers?.filter(m=>m.active).map(m=><option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></label><button disabled={busy}>Create and share ↗</button></form></section>}
   {createdQuestion&&origin&&data.questions.some(q=>q.id===createdQuestion)&&<section className="card created-share"><span className="eyebrow">CALL CREATED</span><h2>Put it in the group chat.</h2><SharePanel autoOpen card={betCard(data.group.name,data.questions.find(q=>q.id===createdQuestion)!.text,data.questions.find(q=>q.id===createdQuestion)!.picked)} url={shareLink(origin,invite,{questionId:createdQuestion,roundId:data.selectedRound?.id},!!data.demoNow)}/></section>}
   {football&&<FootballPanel data={data} act={act} busy={busy}/>}
   {todo.length>0&&<div className="section-head"><h2>Your calls</h2><span className="count-pill hot">{todo.length} to go</span></div>}
   {todo.length===0&&openQs.length>0&&<div className="all-set"><span>✅</span><div><strong>You’re all set</strong><p>Change any pick until it locks.</p></div></div>}
   <div className="questions">{[...todo,...picked].map((q,i)=>{const header=i===todo.length&&picked.length>0?<div className="section-head" key={'h'+q.id}><h2>Picked</h2><span className="count-pill">{picked.length}</span></div>:null;const sharing=origin?<SharePanel card={betCard(data.group.name,q.text,q.picked,marketLabel(q.market))} url={shareLink(origin,invite,{questionId:q.id,roundId:data.selectedRound?.id},!!data.demoNow)}/>:null;return <div key={q.id} className="q-wrap">{header}{(q.market||'custom')==='custom'?<Prediction q={q} next={i===0&&todo.length>0} members={data.members} now={clock} active={active} busy={busy} share={sharing} onSave={(answer,stake)=>act({action:'predict',questionId:q.id,answer,stake},true)}/>:<FootballPick q={q} now={clock} active={canPickFootball} busy={busy} share={sharing} onSave={(answer,stake)=>act({action:'predict',questionId:q.id,answer,stake})}/>}</div>})}</div>
   {!data.questions.length&&data.members>=3&&<div className="empty"><span className="emoji">{football?'⚽️':'🗣️'}</span><h2>{football?'Matchday is on its way':'Start the first “told you so”'}</h2><p>{football?'Matches appear when the round opens.':'Add the first call. Everyone gets 100 confidence points.'}</p>{!football&&!!data.suggestions?.length&&<button className="secondary" disabled={createClosed} onClick={()=>{setTemplate('Will everyone arrive on time this weekend?');setCreate(true)}}>Try: “Will everyone arrive on time?”</button>}</div>}
   <LifecyclePanel view="results" data={data} act={act} busy={busy} focusQuestion={focusQuestion} shareContext={{groupName:data.group.name,invite,origin,demo:!!data.demoNow}}/>
  </>}

  {tab==='ranking'&&<>
   {lastFinal&&board?.id!==lastFinal.id&&<section className="winner-card"><div className="confetti" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i}/>)}</div><span className="trophy" aria-hidden="true">🏆</span><span className="kicker">{lastFinal.winners.length>1?'Shared win':'Last week’s winner'}</span><h3>{lastFinal.winners.map(w=>w.name).join(' & ')}</h3><p><strong>{(lastFinal.winners[0].points_tenths/10).toFixed(1)}</strong> pts</p>{origin&&<SharePanel card={winnerCard(data.group.name,lastFinal)} url={shareLink(origin,invite,{roundId:lastFinal.id,winner:true},!!data.demoNow)}/>}</section>}
   <WeeklyBoard groupName={data.group.name} invite={invite} origin={origin} demo={!!data.demoNow} rounds={data.rounds||[]} selected={board} suggestions={undefined} onSelect={id=>setBoardRound(id)} onTemplate={()=>{}}/>
   <LifecyclePanel view="seasons" data={data} act={act} busy={busy}/>
  </>}

  {tab==='open'&&<LifecyclePanel view="open" data={data} act={act} busy={busy} focusQuestion={focusQuestion} shareContext={{groupName:data.group.name,invite,origin,demo:!!data.demoNow}}/>}

  {tab==='group'&&<>
   <section className="card group-card"><span className="eyebrow">INVITE</span><h2>{data.group.name}</h2><p>{data.members}/30 friends · {roundType} group · {zone}</p><div className="actions"><button onClick={copy}>Copy invite link</button><a className="button whatsapp" target="_blank" rel="noreferrer" href={'https://wa.me/?text='+encodeURIComponent('Join '+data.group.name+' on '+BRAND_NAME+': '+(origin?shareLink(origin,invite):''))}>WhatsApp ↗</a></div></section>
   {!football&&<FootballPanel data={data} act={act} busy={busy}/>}
   <HowItWorks/>
   <LifecyclePanel view="group" featureFocus={featureFocus} notificationFocus={notificationFocus} data={data} act={act} busy={busy} shareContext={{groupName:data.group.name,invite,origin,demo:!!data.demoNow}}/>
  </>}
  </main>

  {error&&<p className="toast error" role="alert" onClick={()=>setError('')}>{error}</p>}{notice&&<p className="toast" role="status">{notice}</p>}
  <nav className="tabbar" aria-label="Sections">{TABS.map(t=><button key={t.id} className={tab===t.id?'on':''} aria-current={tab===t.id?'page':undefined} onClick={()=>go(t.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon}/></svg><span>{t.label}</span>{t.id==='group'&&unread>0&&<i className="badge">{unread}</i>}</button>)}</nav>
 </div>;
}

function Stake({value,onChange,disabled}:{value:number;onChange:(v:number)=>void;disabled?:boolean}){
 return <div className="stake" role="radiogroup" aria-label="Confidence points">{[5,10,15,20,25,30].map(v=><button key={v} type="button" role="radio" aria-checked={value===v} disabled={disabled} className={value===v?'on':''} onClick={()=>onChange(v)}>{v}</button>)}</div>;
}

function Prediction({q,next,members,active,busy,onSave,now,share}:{q:Question;next?:boolean;members:number;share?:React.ReactNode;now:number;active:boolean;busy:boolean;onSave:(answer:string,stake:number)=>Promise<boolean>}){
 const [answer,setAnswer]=useState(q.answer||''),[stake,setStake]=useState(q.stake||10),[editing,setEditing]=useState(false),[saved,setSaved]=useState(false);const locked=now>=new Date(q.locks_at).getTime();const hidden=q.moderation_state&&q.moderation_state!=='visible';
 useEffect(()=>{setAnswer(q.answer||'');setStake(q.stake||10)},[q.answer,q.stake]);
 useEffect(()=>{if(!saved)return;const t=setTimeout(()=>setSaved(false),1400);return ()=>clearTimeout(t)},[saved]);
 if(hidden)return <section className="bet"><h3>Call hidden by moderation</h3><p className="note">See Group → Safety.</p></section>;
 const options=q.options?.length?q.options:['yes','no'];const dirty=answer!==(q.answer||'')||stake!==(q.stake||10);const soon=Date.parse(q.locks_at)-now<6*3600000;
 async function save(){if(await onSave(answer,stake)){setSaved(true);setEditing(false)}}
 if(q.answer&&!editing)return <section className={'bet compact'+(saved?' saved':'')} id={'bet-'+q.id} tabIndex={-1}><div className="compact-row"><div><h3>{q.text}</h3><p className="meta-line">{locked?'Locked':'Locks '+when(q.locks_at,now)} · {q.picked}/{members} picked</p></div><div className="my-pick"><span className="pick-chip">{saved?'✓ ':''}{answerLabel(q.answer)}</span><small>{q.stake} pts</small></div></div>{!locked&&active&&<div className="compact-actions"><button className="text-button" onClick={()=>setEditing(true)}>Change</button>{share}</div>}</section>;
 return <section className={'bet'+(next?' next':'')} id={'bet-'+q.id} tabIndex={-1}><div className="bet-meta"><span className={'lock'+(soon&&!locked?' soon':'')}>{locked?'Locked':soon?'⏰ Locks in '+countdown(q.locks_at,now):'Locks '+when(q.locks_at,now)}</span><span>{q.picked}/{members} picked</span></div><h3>{q.text}</h3>
  <div className={'answers'+(options.length>2?' grid':'')}>{options.map(a=><button key={a} disabled={locked||!active} className={answer===a?'selected':'secondary'} onClick={()=>setAnswer(a)}>{answerLabel(a)}</button>)}</div>
  {answer&&<div className="stake-row"><span>How sure?</span><Stake value={stake} onChange={setStake} disabled={locked||!active}/></div>}
  {answer&&(dirty||!q.answer)&&<button className="save" disabled={locked||!active||busy} onClick={save}>{!active?'Opens with the round':q.answer?'Update pick':'Lock in '+stake+' pts'}</button>}
  {!active&&!answer&&<p className="note">Opens with the round.</p>}
  {editing&&<button className="text-button" onClick={()=>{setEditing(false);setAnswer(q.answer||'');setStake(q.stake||10)}}>Cancel</button>}
  {!answer&&<div className="bet-foot">{share}</div>}</section>;
}

function JoinWithPick({preview,busy,clock,onJoin}:{preview:Preview;busy:boolean;clock:number;onJoin:(name:string,answer:string,stake:number,questionId:string,scope:string)=>void}){
 const [answer,setAnswer]=useState(''),[stake,setStake]=useState(10),[name,setName]=useState('');
 const options=preview.options?.length?preview.options:['yes','no'];const locked=clock>=Date.parse(preview.locks_at);
 return <section className="card join-bet"><div className="bet-meta"><span>{preview.scope==='longterm'?'LONG-TERM CALL':'GROUP CALL'}</span><span>{locked?'Locked':'Locks '+when(preview.locks_at,clock)}</span></div><h2>{preview.text}</h2><p className="muted">{preview.picked} friends already picked</p>
  {!locked&&<><div className={'answers'+(options.length>2?' grid':'')}>{options.map(a=><button key={a} className={answer===a?'selected':'secondary'} onClick={()=>setAnswer(a)}>{answerLabel(a)}</button>)}</div>
  {preview.scope!=='longterm'&&<div className="stake-row"><span>Confidence</span><Stake value={stake} onChange={setStake}/></div>}</>}
  <form onSubmit={e=>{e.preventDefault();onJoin(name.trim(),locked?'':answer,stake,preview.id,preview.scope)}}><label>Your name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={60} placeholder="What do your friends call you?" autoComplete="given-name"/></label><button disabled={busy||!name.trim()||(!locked&&!answer)}>{locked?'Join the group ↗':'Join and lock in my pick ↗'}</button></form>
  <small>No download, no money. Just a name. For players aged 18 and over.</small></section>;
}
