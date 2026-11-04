'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import LifecyclePanel,{type LifecycleData} from './LifecyclePanel';
import type {WeeklyRound} from './rounds-types';
import FootballPanel,{type FootballQuestion,type FootballData} from './Football';
import {slotLimits,period} from '../lib/football/rules';
import {betCard,inviteCard,shareLink,shortLink,shareText,winnerCard} from '../lib/sharing';
import {when,countdown,kickLabel} from './format';
import HowItWorks from './HowItWorks';
import {BRAND,BRAND_NAME} from '../lib/brand';
import {api,webOrigin,setSession,lastInvite,rememberInvite,NATIVE} from './api-client';
import {initNative,haptic,updateWidget} from './native';
import {Face,Faces,Icon} from './ui';
import {type Call,type Snapshot,sortCalls,answersOf,label,matchTitle} from './calls';
import {CallsList,SectionTitle,type CallsAct,type CallsCtx} from './CallsTab';
import {PickSheet,RevealSheet,ResultSheet,ResolveSheet,ShareSheet,CallPreview} from './Sheets';
import {NewCallSheet,type NewCall} from './NewCallSheet';
import RankingTab from './RankingTab';
import {ProfileSheet,LevelUpSheet,LevelPill} from './Career';
import {LEVELS as CAREER_LEVELS,type Career} from '../lib/career';
import {setGroupOrder} from '../lib/avatar';
import type {SeasonView} from './SeasonsPanel';

type Preview={answers?:{value:string;label:string}[];kickoff?:string|null;id:string;text:string;options:string[]|null;locks_at:string;event_at?:string|null;scope:string;state:string;picked:number;creator_name?:string};
type Member={user_id:string;name:string;active:boolean;admin:boolean;fallback?:boolean};
type GroupView=LifecycleData & FootballData & {timing?:{practice:boolean;disputeMs:number;resolutionMs:number};group:{name:string;opens_at?:string;practice?:boolean;share_code?:string};members:number;memberNames?:string[];joined:boolean;user?:{id?:string;name:string};questions:FootballQuestion[];used:number;rounds?:WeeklyRound[];selectedRound?:WeeklyRound & {deadline_at:string};currentRoundId?:string;preview?:Preview|null;bets?:Call[];snapshots?:Snapshot[];groupMembers?:Member[];seasons?:SeasonView[];alerts?:{id:string;question_id?:string|null;stage:string;text:string}[];secretCount?:number;careers?:Career[];comingUp?:{opensAt:string;matches:{home:string;away:string;kickoff:string;league_name:string;reason:string;motw:boolean}[]}|null};
type Tab='calls'|'ranking'|'group';
const TABS:{id:Tab;label:string;icon:string}[]=[{id:'calls',label:'Calls',icon:'calls'},{id:'ranking',label:'Ranking',icon:'ranking'},{id:'group',label:'Group',icon:'group'}];
const SEEN='calld.seen.';
const seen=(id:string)=>{try{return !!localStorage.getItem(SEEN+id)}catch{return true}};
const markSeen=(id:string)=>{try{localStorage.setItem(SEEN+id,'1')}catch{}};

/** Universal links in the app: long links carry the invite, short links (/c/<code>) are looked up first. */
async function openLink(url:string){const u=new URL(url);if(u.searchParams.get('invite')){location.href='/'+u.search;return}const code=u.pathname.match(/^\/c\/([A-Za-z0-9]+)$/)?.[1];if(!code)return;try{const r=await api('/api?code='+code);if(!r.ok)return;const t=await r.json() as {invite:string;questionId?:string;roundId?:string;winner?:boolean};const q=new URLSearchParams({invite:t.invite});if(t.questionId)q.set('question',t.questionId);if(t.roundId)q.set('round',t.roundId);if(t.winner)q.set('view','winner');location.href='/?'+q.toString()}catch{}}

export default function Home(){
 const [invite,setInvite]=useState(''),[data,setData]=useState<GroupView|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [tab,setTab]=useState<Tab>('calls'),[practiceAllowed,setPracticeAllowed]=useState(false),[boardRound,setBoardRound]=useState(''),[origin,setOrigin]=useState(''),[focusQuestion,setFocusQuestion]=useState(''),[notificationFocus,setNotificationFocus]=useState(0),[featureFocus,setFeatureFocus]=useState({name:'',tick:0});
 const [pick,setPick]=useState<{call:Call;preset?:string}|null>(null),[flow,setFlow]=useState<string[]|null>(null),[revealing,setRevealing]=useState<Call|null>(null),[result,setResult]=useState<Call|null>(null),[resolving,setResolving]=useState<{call:Call;mode:'set'|'judge'}|null>(null),[creating,setCreating]=useState(false),[sharing,setSharing]=useState<{title:string;text:string;url:string;preview?:React.ReactNode}|null>(null),[createdId,setCreatedId]=useState(''),[profile,setProfile]=useState(''),[levelUp,setLevelUp]=useState('');
 const selectedRound=useRef(''),focused=useRef(''),requestId=useRef('');

 async function load(code:string){const r=await api('/api?invite='+encodeURIComponent(code)+(selectedRound.current?'&round='+encodeURIComponent(selectedRound.current):'')+(focusRef.current?'&question='+encodeURIComponent(focusRef.current):''));const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);void rememberInvite(code);}
 const focusRef=useRef('');
 useEffect(()=>{void api('/api?config').then(r=>r.json()).then(c=>setPracticeAllowed(!!c.practiceAllowed)).catch(()=>{})},[]);
 useEffect(()=>{setOrigin(webOrigin());void (async()=>{const params=new URLSearchParams(location.search);focusRef.current=params.get('question')||'';setFocusQuestion(focusRef.current);if(params.get('view')==='winner')setTab('ranking');const code=params.get('invite')||(await lastInvite())||'';selectedRound.current=params.get('round')||'';setInvite(code);if(code)await load(code).catch(e=>setError(e.message));setLoading(false);if(NATIVE)void initNative({onOpen:url=>{void openLink(url)}});})()},[]);
 async function act(payload:Record<string,unknown>,message?:string){setError('');setBusy(true);try{const r=await api('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,invite})});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.session)await setSession(d.session);if(payload.action==='predict'||payload.action==='predictLongterm')void haptic('pick');if(NATIVE&&(payload.action==='join'||payload.action==='create'))void initNative({register:true});if(d.focusTab)setFeatureFocus(v=>({name:d.focusTab,tick:v.tick+1}));if(d.invite){setInvite(d.invite);const next=new URL(location.href);next.searchParams.set('invite',d.invite);history.replaceState(null,'',next);await load(d.invite);}if(d.questionId&&(payload.action==='question'||payload.action==='longterm'))setCreatedId(d.questionId);if(message)setNotice(message);return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
 useEffect(()=>{if(!invite)return;const timer=setInterval(()=>{void load(invite).catch(()=>{})},15000);return ()=>clearInterval(timer)},[invite]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return ()=>clearTimeout(t)},[notice]);
 useEffect(()=>{if(!error)return;const t=setTimeout(()=>setError(''),6000);return ()=>clearTimeout(t)},[error]);

 const clock=data?.demoNow||Date.now();
 const me=data?.user?.id,meName=data?.user?.name;
 const members=data?.groupMembers||[];
 const names=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m.name])),[members]);
 setGroupOrder(data?.joined?members.map(m=>m.name):data?.memberNames||[]);
 // Football questions carry their match: teams, kickoff, league. Matches then sit in the same list as every other call.
 const calls=useMemo(()=>((data?.bets||[]) as Call[]).map(c=>{const q=c.fixture_id?data!.questions.find(x=>x.id===c.id):null;if(!q?.home||!q.away)return c;
  const motw=data!.questions.some(x=>x.fixture_id===q.fixture_id&&x.slot==='motw');const match={home:q.home,away:q.away,kickoff:q.kickoff,league:q.league_name,slot:motw?'motw':q.slot,reason:q.selection_reason,home90:q.home90,away90:q.away90};
  return {...c,market:c.market||q.market,match,text:matchTitle({market:c.market||q.market,match,text:c.text})}}),[data?.bets,data?.questions]);const snaps=(data?.snapshots||[]) as Snapshot[];
 const sections=useMemo(()=>sortCalls(calls,me,clock),[calls,me,clock]);
 const findCall=(id:string)=>calls.find(c=>c.id===id);
 const linkFor=(c:Call)=>origin?(c.share_code?shortLink(origin,c.share_code):shareLink(origin,invite,{questionId:c.id,roundId:c.round_id||undefined})):'';
 const groupLink=origin&&data?.group.share_code?shortLink(origin,data.group.share_code):origin?shareLink(origin,invite):'';

 // Open what a shared link or notification pointed at, once.
 useEffect(()=>{if(!data?.joined||!focusQuestion||focused.current===focusQuestion)return;const c=findCall(focusQuestion);if(!c)return;focused.current=focusQuestion;setTab('calls');
  if(['settled','void'].includes(c.state))setResult(c);else if(clock<Date.parse(c.locks_at)&&c.state==='open'){if(!c.answer&&c.subject_id!==me)startFlow(c)}else setRevealing(c);},[data?.joined,focusQuestion,data?.bets]);
 // Show a fresh result once: the "called it" moment.
 useEffect(()=>{if(!data?.joined||result||pick||creating)return;const fresh=sections.results.find(c=>c.answer&&c.state==='settled'&&!seen(c.id)&&clock-Date.parse(c.settled_at||c.locks_at)<3*86400000);if(fresh){markSeen(fresh.id);setResult(fresh);if(fresh.answer===fresh.result_answer)void haptic('win')}},[data?.bets]);
 // Level up: shown once, the first time the app sees you at a higher level.
 useEffect(()=>{if(!data?.joined||!me)return;const mine=data.careers?.find(c=>c.user_id===me);if(!mine)return;const key='calld.level.'+invite;let seenLevel=0;try{seenLevel=Number(localStorage.getItem(key)||0)}catch{return}if(seenLevel&&mine.level.n>seenLevel){setLevelUp(CAREER_LEVELS[seenLevel-1]?.name||'');void haptic('win')}try{localStorage.setItem(key,String(mine.level.n))}catch{}},[data?.careers]);
 // After making a call, offer to put it in the group chat.
 useEffect(()=>{if(!createdId)return;const c=findCall(createdId);if(!c)return;setCreatedId('');openShare(c,'Send it to the group');},[createdId,data?.bets]);
 // Home-screen widget and weekly-win haptic (app only).
 useEffect(()=>{if(!NATIVE||!data?.joined||!data.user)return;const live=data.selectedRound?.standings.find(s=>s.user_id===me);const final=(data.rounds||[]).find(r=>r.state==='final');const mine=live&&live.points_tenths>0?live:final?.standings.find(s=>s.user_id===me);
  const next=nextLockAt();void updateWidget({group:data.group.name,rank:mine?.rank??null,members:data.members,points:mine?Math.round(mine.points_tenths/10):null,toGo:sections.yourTurn.length,nextLockAt:next?new Date(next).toISOString():null,updatedAt:new Date().toISOString(),invite});
  if(final&&final.winners.some(w=>w.user_id===me)){const k='calld.celebrated.'+final.id;try{if(!localStorage.getItem(k)){localStorage.setItem(k,'1');void haptic('win')}}catch{}}
 },[data,invite]);

 function openShare(c:Call,title='Share this call'){const url=linkFor(c);if(!url)return;
  const m=c.match;
  if(m){const k=kickLabel(m.kickoff||c.locks_at,new Date(),zone);setSharing({title,url,text:`${m.home} – ${m.away}, ${k.charAt(0).toLowerCase()+k.slice(1)}.\n${c.answer?'I’ve made my call. Have you?':c.market==='result'?'Who wins? Make your call:':'Make your call:'} ${url}`,preview:<CallPreview call={{...c,options:c.market==='exact_score'?['Exact score']:null,market:c.market==='exact_score'?undefined:c.market,creator_name:BRAND_NAME}} groupName={data!.group.name} pickers={(c.picker_ids||[]).map(id=>names[id]).filter(Boolean)} foot={(m.league||'Football')+' · '+data!.group.name}/>});return}const pickers=(c.picker_ids||[]).map(id=>names[id]).filter(Boolean);const about=c.subject_id?names[c.subject_id]:'';setSharing({title,url,text:about&&!['settled','void'].includes(c.state)?`There’s a secret call about ${about} in ${data!.group.name}. ${about}, don’t look. ${url}`:shareText(betCard(data!.group.name,c.text,c.picked||0,answersOf(c).map(a=>label(a,c))),url),preview:<CallPreview call={c} groupName={data!.group.name} pickers={pickers}/>})}
 /** Go through every open call, one after another, starting from the one you tapped. */
 function startFlow(first:Call,preset?:string){const open=sortCalls(calls,me,Date.now()).yourTurn.map(c=>c.id).filter(id=>id!==first.id);const ids=!first.answer?[first.id,...open]:[first.id];setFlow(ids);setPick({call:first,preset})}
 function advance(from:Call){const ids=flow||[];const i=ids.indexOf(from.id);const next=ids.slice(i+1).map(id=>findCall(id)).find(c=>c&&!c.answer&&c.state==='open'&&Date.now()<Date.parse(c.locks_at));if(next){setPick({call:next});return true}setPick(null);setFlow(null);return false}
 function nextLockAt(){const t=[...calls.filter(c=>c.state==='open'&&!c.fixture_id).map(c=>Date.parse(c.locks_at)),...(data?.questions||[]).filter(q=>(q.market||'custom')!=='custom').map(q=>Date.parse(q.locks_at))].filter(x=>x>clock).sort((a,b)=>a-b);return t[0]}
 async function joinAndPick(name:string,answer:string,p:Preview|null){const joined=await act({action:'join',name});if(!joined)return;if(!p||!answer){setNotice('You’re in. Let’s make it interesting.');return;}const ok=await act(p.scope==='longterm'?{action:'predictLongterm',questionId:p.id,answer}:{action:'predict',questionId:p.id,answer});setNotice(ok?'You’re in, and your call is saved.':'You’re in. That call isn’t taking picks right now.');}
 function go(t:Tab){setTab(t);window.scrollTo({top:0});void haptic('tap');}

 if(loading)return <main className="c-loading" role="status"><span className="c-brandmark big">{BRAND}</span></main>;

 // Landing: start a group.
 if(!invite)return <main className="c-landing">
  <div className="c-landing-top"><span className="c-brandmark big">{BRAND}</span><span className="c-pill">Free. No money. Ever.</span></div>
  <h1>Big opinions.<br/><em>Zero money.</em></h1>
  <p className="c-lead">Make calls on football and on each other. See who said what when it locks. Get bragging rights when you’re right.</p>
  <form className="c-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const practice=f.get('practice')==='1';const payload:Record<string,unknown>={action:'create',name:f.get('name'),groupName:f.get('groupName'),practice};if(!practice)payload.groupType=f.get('groupType');try{payload.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}const region=navigator.languages?.map(l=>l.split('-')[1]).find(r=>r&&/^[A-Za-z]{2}$/.test(r));if(region)payload.country=region.toUpperCase();void act(payload,'Your group is ready. Invite two friends to start.');}}>
   <h2>Start your group</h2>
   <label>Your name<input name="name" required maxLength={60} placeholder="What do your friends call you?" autoComplete="given-name"/></label>
   <label>Group name<input name="groupName" required maxLength={60} placeholder="Sunday League Lads"/></label>
   <label>What will you call?<select name="groupType" defaultValue="Friends"><option value="Friends">Our own calls</option><option value="Football">Football matches</option><option value="Mixed">Both</option></select></label>
   {practiceAllowed&&<label className="c-check"><input type="checkbox" name="practice" value="1"/><span><b>Practice group</b><small>For testing: a whole week in an hour. Your own calls only: real football runs on the real calendar.</small></span></label>}
   <button className="c-btn" disabled={busy}>Create group <Icon name="arrow"/></button>
   <small>The game starts once three friends join. Points are free and can’t be bought or cashed out. For players aged 18 and over.</small>
  </form>
  {error&&<p className="c-toast error" role="alert">{error}</p>}
 </main>;

 if(!data)return <main className="c-landing">{error&&<p className="c-toast error" role="alert">{error}</p>}</main>;

 // Opened from a link, not in the group yet: the call comes first.
 if(!data.joined)return <JoinScreen data={data} busy={busy} clock={clock} onJoin={joinAndPick} error={error} notice={notice}/>;

 const practice=!!data.group.practice;
 const roundType=data.selectedRound?.group_type||data.group.group_type||'Friends',limits=slotLimits(roundType),zone=data.selectedRound?.timezone||data.group.timezone||'UTC';
 const football=roundType!=='Friends';
 const start=data.group.opens_at?new Date(data.group.opens_at):null;
 const active=!!start&&clock>=start.getTime()&&(!data.selectedRound||(data.selectedRound.state==='live'&&data.selectedRound.content_ready!==false&&data.currentRoundId===data.selectedRound.id));
 const customUsed=data.questions.filter(q=>(q.market||'custom')==='custom').length;
 const cutoff=start?period(start,roundType,zone,practice).customCutoff.getTime():0;
 const weeklyOpen=active&&limits.custom>0&&customUsed<limits.custom&&clock<=cutoff;
 const weeklyWhy=data.members<3?'This week’s calls start once three friends are in. Later works now.':limits.custom===0?'Football groups pick matches. Later works for your own calls.':customUsed>=limits.custom?`This week already has ${limits.custom} calls. Try Later.`:!active?(start&&clock<start.getTime()?'This week opens '+when(start,clock,zone)+'. Later works now.':'This week has wrapped up. Later works now.'):'Adding calls has closed for this week. Try Later.';
 const canPickFootball=!!data.selectedRound&&['live','provisional'].includes(data.selectedRound.state)&&data.selectedRound.content_ready!==false&&clock<=Date.parse(data.selectedRound.pick_end_at||'');
 const unread=data.notifications?.filter(n=>!n.read_at).length||0;
 const myRow=data.selectedRound?.standings.find(s=>s.user_id===me);const anyPoints=!!data.selectedRound?.standings.some(s=>s.points_tenths>0);
 const nextLock=nextLockAt();
 const status=data.members<3?'Waiting for '+(3-data.members)+' more '+(3-data.members===1?'friend':'friends'):start&&clock<start.getTime()?'First week opens '+when(start,clock,zone):!active?'This week has wrapped up':(sections.yourTurn.length?sections.yourTurn.length+(sections.yourTurn.length===1?' call':' calls')+' waiting for you':'You’re all caught up')+(nextLock?' · next lock in '+countdown(nextLock,clock):'');
 const lastFinal=(data.rounds||[]).find(r=>r.state==='final'&&r.winners.length>0);
 const liveEmpty=!!data.selectedRound&&data.selectedRound.state!=='final'&&data.selectedRound.standings.every(x=>x.points_tenths===0);
 const board=(data.rounds||[]).find(r=>r.id===boardRound)||(liveEmpty&&lastFinal?lastFinal:data.selectedRound);
 const judgeFor=new Set((data.alerts||[]).filter(a=>a.stage==='judgment requested'&&a.question_id).map(a=>a.question_id!));
 const ctx:CallsCtx={me,meName,names,now:clock,snaps,admin:!!members.find(m=>m.user_id===me)?.admin,activeIds:new Set(members.filter(m=>m.active).map(m=>m.user_id)),judgeFor,disputeMs:data.timing?.disputeMs||86400000,busy};
 const a:CallsAct={pick:(c,ans)=>startFlow(c,ans),reveal:setRevealing,result:c=>{markSeen(c.id);setResult(c)},resolve:(c,mode)=>setResolving({call:c,mode}),dispute:c=>{if(window.confirm('Say the result isn’t right? A friend who stayed out of it will decide.'))void act({action:'dispute',questionId:c.id},'Got it. A friend will decide.')},share:c=>openShare(c)};
 const myCareer=data.careers?.find(c=>c.user_id===me);
 const footballQs=data.questions.filter(q=>(q.market||'custom')!=='custom');
 const stepOf=pick&&flow&&flow.length>1?{n:flow.indexOf(pick.call.id)+1,of:flow.length}:undefined;
 // Matches are in the list above. Here: only "waiting for matches" and next week's preview.
 const waitingMatches=football&&!footballQs.length&&data.selectedRound?.state==='waiting_feed';
 const footballBlock=football&&(waitingMatches||data.comingUp)?<>{waitingMatches&&<section className="c-card coming"><span className="c-badge later">Matches</span><h3>This week’s matches are on their way</h3><p className="c-sub">They show up here as soon as they’re published.</p></section>}{data.comingUp&&<ComingUp c={data.comingUp} zone={zone} now={clock}/>}</>:null;
 const nothing=!sections.yourTurn.length&&!sections.locked.length&&!sections.inIt.length&&!sections.later.length&&!sections.results.length&&!football;
 const others=members.filter(m=>m.active&&m.user_id!==me).map(m=>({id:m.user_id,name:m.name}));

 return <div className="c-shell">
  <header className="c-top">
   <div className="c-top-row">
    <div className="c-top-main"><span className="c-top-kicker">{practice?<b className="c-practice">Practice · a week in an hour</b>:roundType==='Friends'?'Friends':roundType}</span><h1>{data.group.name}</h1><Faces names={members.filter(m=>m.active).map(m=>m.name)} size={26} ring="#17201B" max={7}/>{myCareer&&<LevelPill c={myCareer} dark onClick={()=>setProfile(me!)}/>}</div>
    <div className="c-top-side"><button className="c-bell" aria-label={unread?unread+' unread notifications':'Notifications'} onClick={()=>{go('group');setNotificationFocus(n=>n+1)}}><Icon name="bell" size={20}/>{unread>0&&<i>{unread}</i>}</button>
     <button className="c-rank" onClick={()=>go('ranking')} aria-label="Ranking">{myRow&&anyPoints?<><b>#{myRow.rank}</b><span>this week</span></>:<><b>{sections.yourTurn.length}</b><span>to call</span></>}</button></div>
   </div>
   <p className="c-top-status">{status}</p>
  </header>

  <main className="app c-main">
  {tab==='calls'&&<>
   {data.members<3&&<section className="c-card invite"><h3>Good calls need good company.</h3><p>Get {3-data.members} more {data.members===2?'friend':'friends'} in and the week starts. Later calls work already.</p><button className="c-btn" onClick={()=>setSharing({title:'Invite friends',url:groupLink,text:shareText(inviteCard(data.group.name,members.map(m=>m.name)),groupLink,meName)})}><Icon name="share"/> Invite friends</button></section>}
   {football&&!practice&&data.selectedRound?.state==='skipped'&&clock<Date.parse(data.selectedRound.pick_end_at||'')&&members.find(m=>m.user_id===me)?.admin&&<section className="c-card starter"><span className="c-kicker dark">This week</span><h3>No matches were published in time</h3><p>Added some since? Open this week now with them.</p><button className="c-btn" disabled={busy} onClick={()=>void act({action:'startFirstWeek'},'This week is on. Make your calls.')}>Open this week now</button></section>}
   {data.members>=3&&start&&clock<start.getTime()&&!practice&&<section className="c-card starter"><span className="c-kicker dark">First week</span><h3>Starts {when(start,clock,zone)}</h3>{members.find(m=>m.user_id===me)?.admin?<><p>Don’t want to wait? Start a short first week now. It runs until then, and the normal weeks follow.</p><button className="c-btn" disabled={busy} onClick={()=>{if(window.confirm('Start the first week now? Everyone can make their calls straight away.'))void act({action:'startFirstWeek'},'The first week is on. Make your calls.')}}>Start the first week now</button></>:<p>The admin can start it early. Until then, you can look around.</p>}</section>}
   {!!data.secretCount&&<section className="c-secret"><span className="c-secret-icon"><Icon name="eyeoff" size={22}/></span><div><b>{data.secretCount===1?'There’s a secret call about you.':'There are '+data.secretCount+' secret calls about you.'}</b><p>Your friends are talking about you. You’ll see {data.secretCount===1?'it':'them'} once it’s settled.</p></div></section>}
   <CallsList s={sections} ctx={ctx} act={a} football={footballBlock}/>
   {nothing&&<div className="c-empty"><h2>Start the first “told you so”</h2><p>Make a call about anything: the weekend, the derby, who’s late. Right calls earn points; bold ones earn more. Free, every week.</p><button className="c-btn" onClick={()=>setCreating(true)}><Icon name="plus"/> New call</button></div>}
   <button className="c-fab" onClick={()=>setCreating(true)}><Icon name="plus" stroke={2.6}/> New call</button>
  </>}

  {tab==='ranking'&&<RankingTab rounds={data.rounds||[]} board={board} onSelect={setBoardRound} me={me} meName={meName} calls={calls} snaps={snaps} seasons={data.seasons||[]} admin={!!members.find(m=>m.user_id===me)?.admin} busy={busy} act={p=>act(p)} clock={clock} careers={data.careers||[]} names={names} onProfile={setProfile} onShareWinner={r=>{const url=origin?r.share_code?shortLink(origin,r.share_code):shareLink(origin,invite,{roundId:r.id,winner:true}):'';setSharing({title:'Share the winner',url,text:shareText(winnerCard(data.group.name,r),url)})}}/>}

  {tab==='group'&&<>
   <section className="c-card group-invite"><span className="c-kicker dark">Invite</span><h3>{data.group.name}</h3><Faces names={members.filter(m=>m.active).map(m=>m.name)} size={30}/><p>{data.members} {data.members===1?'friend':'friends'} · up to 30</p>
    <button className="c-btn" onClick={()=>setSharing({title:'Invite friends',url:groupLink,text:shareText(inviteCard(data.group.name,members.map(m=>m.name)),groupLink,meName)})}><Icon name="share"/> Invite friends</button></section>
   <FootballPanel data={data} act={p=>act(p)} busy={busy}/>
   <LifecyclePanel view="group" featureFocus={featureFocus} notificationFocus={notificationFocus} data={data} act={p=>act(p,'Saved.')} busy={busy} shareContext={{groupName:data.group.name,invite,origin,demo:!!data.demoNow}}/>
   <HowItWorks/>
  </>}
  </main>

  {error&&<p className="c-toast error" role="alert" onClick={()=>setError('')}>{error}</p>}{notice&&<p className="c-toast" role="status">{notice}</p>}
  <nav className="c-tabbar" aria-label="Sections">{TABS.map(t=><button key={t.id} className={tab===t.id?'on':''} aria-current={tab===t.id?'page':undefined} onClick={()=>go(t.id)}><span className="c-tab-icon"><Icon name={t.icon} size={22}/></span><span>{t.label}</span>{t.id==='group'&&unread>0&&<i className="c-dot">{unread}</i>}</button>)}</nav>

  <PickSheet call={pick?.call||null} preset={pick?.preset} step={stepOf} onSkip={()=>{if(pick)advance(pick.call)}} names={names} longCount={data.longTermCount||0} now={clock} busy={busy} onClose={()=>{setPick(null);setFlow(null)}} onSave={async(c,answer)=>{const inFlow=!!stepOf&&stepOf.n<stepOf.of;const ok=await act(c.scope==='longterm'?{action:'predictLongterm',questionId:c.id,answer}:{action:'predict',questionId:c.id,answer},inFlow?undefined:c.answer?'Updated.':stepOf?'All done. You’ll see how the group is split on each call.':'You’re in. Tap the call to see how the group is split.');if(ok&&inFlow)advance(c);return ok}}/>
  <RevealSheet call={revealing} snaps={snaps} me={me} meName={meName} onClose={()=>setRevealing(null)}/>
  <ResultSheet call={result} snaps={snaps} meName={meName} onClose={()=>setResult(null)} onShare={(c,text)=>{const url=linkFor(c);setResult(null);setSharing({title:'Rub it in',url,text:text+' '+url})}}/>
  <ResolveSheet call={resolving?.call||null} mode={resolving?.mode||'set'} busy={busy} onClose={()=>setResolving(null)} onPick={(c,answer)=>act({action:resolving?.mode==='judge'?'judge':'propose',questionId:c.id,answer},resolving?.mode==='judge'?'Decided. It counts now.':'Result set. Everyone has a day to say if it’s not right.')}/>
  <NewCallSheet open={creating} now={clock} practice={practice} weeklyOpen={weeklyOpen} weeklyWhy={weeklyWhy} deadline={data.selectedRound?Date.parse(data.selectedRound.deadline_at):null} members={others} busy={busy} onClose={()=>setCreating(false)} onCreate={(c:NewCall)=>{const payload:Record<string,unknown>={...c};if(c.action==='question'){requestId.current||=crypto.randomUUID();payload.requestId=requestId.current}return act(payload).then(ok=>{if(ok)requestId.current='';return ok})}}/>
  <ProfileSheet c={data.careers?.find(c=>c.user_id===profile)||null} name={names[profile]||''} me={profile===me} onClose={()=>setProfile('')}/>
  <LevelUpSheet c={levelUp&&myCareer?myCareer:null} from={levelUp} onClose={()=>setLevelUp('')} onShare={()=>{const url=groupLink;setLevelUp('');if(myCareer)setSharing({title:'Tell the group',url,text:`Just levelled up to ${myCareer.level.name} in ${data.group.name} (${myCareer.points.toLocaleString('en-GB')} career points). ${url}`})}}/>
  <ShareSheet open={!!sharing} title={sharing?.title||''} text={sharing?.text||''} url={sharing?.url||''} preview={sharing?.preview} onClose={()=>setSharing(null)} onDone={m=>{setNotice(m);setSharing(null)}}/>
 </div>;
}

/** Next week's matches as soon as they're published: look now, pick from Thursday 12:00. */
function ComingUp({c,zone,now}:{c:NonNullable<GroupView['comingUp']>;zone:string;now:number}){
 const fmt=(t:string)=>new Date(t).toLocaleString('en-GB',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit'});
 return <section className="c-card coming"><div className="c-card-top"><span className="c-badge later">Picks open {when(c.opensAt,now,zone)}</span><span className="c-by">{c.matches.length} matches</span></div><h3>Matches coming up</h3>
  <div className="c-coming">{c.matches.map(m=><div key={m.home+m.kickoff} className="c-coming-row"><span className="c-coming-time">{fmt(m.kickoff)}</span><span className="c-coming-teams"><b>{m.motw?'★ ':''}{m.home} – {m.away}</b><small>{m.reason}</small></span></div>)}</div></section>;
}

function JoinScreen({data,busy,clock,onJoin,error,notice}:{data:GroupView;busy:boolean;clock:number;onJoin:(name:string,answer:string,p:Preview|null)=>void;error:string;notice:string}){
 const p=data.preview||null;const [answer,setAnswer]=useState(''),[name,setName]=useState('');
 const locked=!!p&&(clock>=Date.parse(p.locks_at)||p.state!=='open');const long=p?.scope==='longterm';
 const people=data.memberNames||[];
 const opts=p?.answers||(p?answersOf(p).map(a=>({value:a,label:label(a,p)})):[]);
 return <main className="c-join">
  <div className="c-join-top"><span className="c-brandmark">{BRAND}</span><span>Free · no money, ever</span></div>
  {p?<>
   <div className="c-join-from">{p.creator_name&&!p.answers&&<Face name={p.creator_name} size={48} ring="#FFFFFF"/>}<p>{p.answers?<>Your friends in <b>{data.group.name}</b> want your call</>:<><b>{p.creator_name||'A friend'}</b> wants your call in <b>{data.group.name}</b></>}</p></div>
   <section className="c-join-card">
    <div className="c-card-top"><span className={'c-badge '+(long?'later':'soon')}>{locked?'Picks are closed':long&&p.event_at?'We’ll know in '+new Date(p.event_at).toLocaleDateString('en-GB',{month:'long'}):'Picks close '+when(p.locks_at,clock)}</span><span className="c-by"><Faces names={people} size={22} max={4}/> {data.members} in</span></div>
    <h1>{p.text}</h1>
    {!locked&&<><div className={'c-options'+(opts.length>2?' stack':' pair')} role="radiogroup" aria-label="Your answer">{opts.map(o=><button key={o.value} role="radio" aria-checked={answer===o.value} className={'c-opt big'+(answer===o.value?' on':'')} onClick={()=>setAnswer(o.value)}><span>{o.label}</span>{answer===o.value&&<Icon name="check" size={20} stroke={2.6}/>}</button>)}</div>
     <p className="c-hint">You’ll see what everyone said when picks close.</p></>}
   </section>
  </>:<>
   <div className="c-join-from big"><p>You’re invited to</p><h1>{data.group.name}</h1><Faces names={people} size={40} ring="#17201B"/><p>{people.length?people.slice(0,3).join(', ')+(people.length>3?' and '+(people.length-3)+' more':'')+' '+(people.length===1?'is':'are')+' in.':''}</p></div>
  </>}
  <form className="c-join-form" onSubmit={e=>{e.preventDefault();onJoin(name.trim(),locked?'':answer,p)}}>
   <label htmlFor="join-name">What do your friends call you?</label>
   <input id="join-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={60} placeholder="Your name" autoComplete="given-name"/>
   <button className="c-btn" disabled={busy||!name.trim()||(!!p&&!locked&&!answer)}>{p&&!locked?(answer?'I’m in: '+(opts.find(o=>o.value===answer)?.label||label(answer)):'Pick an answer first'):'Join the group'}</button>
   <small>No sign-up form. Nothing to spend: you earn points by being right, just for bragging rights. Points can’t be bought or cashed out. 18+.</small>
  </form>
  {error&&<p className="c-toast error" role="alert">{error}</p>}{notice&&<p className="c-toast" role="status">{notice}</p>}
 </main>;
}
