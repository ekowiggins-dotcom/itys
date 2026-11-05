'use client';
import {t,L,setLang} from './i18n';
import {useEffect,useMemo,useRef,useState} from 'react';
import LifecyclePanel,{type LifecycleData} from './LifecyclePanel';
import type {WeeklyRound} from './rounds-types';
import FootballPanel,{type FootballQuestion,type FootballData} from './Football';
import {slotLimits,period} from '../lib/football/rules';
import {betCard,inviteCard,shareLink,shortLink,shareText,winnerCard} from '../lib/sharing';
import {when,countdown,kickLabel} from './format';
import HowItWorks from './HowItWorks';
import {BRAND,BRAND_NAME} from '../lib/brand';
import {api,webOrigin,setSession,lastInvite,rememberInvite,forgetAccount,NATIVE} from './api-client';
import {initNative,haptic,updateWidget} from './native';
import {Face,Faces,Icon,Sheet,AppleButton} from './ui';
import {appleIdToken} from './apple';
import {GROUP_COLORS} from '../lib/share-art';
import {MomentCard,MomentSheet,NewMomentSheet,PastMoments,OpeningSheet,type NewMoment} from './Moments';
import type {MomentKind} from '../lib/moment-starters';
import {type Call,type Snapshot,type Moment,sortCalls,answersOf,label,matchTitle,momentView} from './calls';
import {CallsList,SectionTitle,canSettle,type CallsAct,type CallsCtx} from './CallsTab';
import {PickSheet,RevealSheet,ResultSheet,ResolveSheet,ShareSheet,CallPreview,FacePicker} from './Sheets';
import {NewCallSheet,type NewCall} from './NewCallSheet';
import RankingTab,{type Boards} from './RankingTab';
import {ProfileSheet,LevelUpSheet} from './Career';
import {LEVELS as CAREER_LEVELS,type Career} from '../lib/career';
import {setGroupOrder} from '../lib/avatar';
import type {SeasonView} from './SeasonsPanel';

type Preview={answer_type?:string;pickedYou?:Record<string,number>;answers?:{value:string;label:string}[];kickoff?:string|null;id:string;text:string;options:string[]|null;locks_at:string;event_at?:string|null;scope:string;state:string;picked:number;creator_name?:string};
type Member={user_id:string;name:string;active:boolean;admin:boolean;fallback?:boolean};
type GroupView=LifecycleData & FootballData & {boards?:Boards;linked?:boolean;timing?:{practice:boolean;disputeMs:number;resolutionMs:number};group:{name:string;opens_at?:string;practice?:boolean;share_code?:string};members:number;memberNames?:string[];pendingNames?:string[];joined:boolean;user?:{id?:string;name:string};questions:FootballQuestion[];used:number;rounds?:WeeklyRound[];selectedRound?:WeeklyRound & {deadline_at:string};currentRoundId?:string;preview?:Preview|null;bets?:Call[];snapshots?:Snapshot[];groupMembers?:Member[];seasons?:SeasonView[];alerts?:{id:string;question_id?:string|null;stage:string;text:string}[];secretCount?:number;careers?:Career[];comingUp?:{opensAt:string;matches:{home:string;away:string;kickoff:string;league_name:string;reason:string;motw:boolean}[]}|null};
type Tab='calls'|'ranking'|'group';
const TABS:{id:Tab;label:string;icon:string}[]=[{id:'calls',label:'Calls',icon:'calls'},{id:'ranking',label:'Ranking',icon:'ranking'},{id:'group',label:'Group',icon:'group'}];
const SEEN='calld.seen.';
const seen=(id:string)=>{try{return !!localStorage.getItem(SEEN+id)}catch{return true}};
const markSeen=(id:string)=>{try{localStorage.setItem(SEEN+id,'1')}catch{}};

/** Universal links in the app: long links carry the invite, short links (/c/<code>) are looked up first. */
async function openLink(url:string){const u=new URL(url);if(u.searchParams.get('invite')){location.href='/'+u.search;return}const code=u.pathname.match(/^\/c\/([A-Za-z0-9]+)$/)?.[1];if(!code)return;try{const r=await api('/api?code='+code);if(!r.ok)return;const t=await r.json() as {invite:string;questionId?:string;roundId?:string;winner?:boolean};const q=new URLSearchParams({invite:t.invite});if(t.questionId)q.set('question',t.questionId);if(t.roundId)q.set('round',t.roundId);if(t.winner)q.set('view','winner');location.href='/?'+q.toString()}catch{}}

export default function Home(){
 const [deviceLang,setDeviceLang]=useState<'tr'|'en'>('en');useEffect(()=>setDeviceLang(uiLang()),[]);
 const [invite,setInvite]=useState(''),[data,setData]=useState<GroupView|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [tab,setTab]=useState<Tab>('calls'),[practiceAllowed,setPracticeAllowed]=useState(false),[boardRound,setBoardRound]=useState(''),[origin,setOrigin]=useState(''),[focusQuestion,setFocusQuestion]=useState(''),[notificationFocus,setNotificationFocus]=useState(0),[featureFocus,setFeatureFocus]=useState({name:'',tick:0});
 const [pick,setPick]=useState<{call:Call;preset?:string}|null>(null),[flow,setFlow]=useState<string[]|null>(null),[revealing,setRevealing]=useState<Call|null>(null),[result,setResult]=useState<Call|null>(null),[resolving,setResolving]=useState<{call:Call;mode:'set'|'judge'}|null>(null),[creating,setCreating]=useState(false),[sharing,setSharing]=useState<{title:string;text:string;url:string;preview?:React.ReactNode;tags?:string[];tag?:string;retag?:(name:string)=>void}|null>(null),[createdId,setCreatedId]=useState(''),[profile,setProfile]=useState(''),[levelUp,setLevelUp]=useState('');
 const [plusOpen,setPlusOpen]=useState(false),[firstOpen,setFirstOpen]=useState(false),[momentId,setMomentId]=useState(''),[newMoment,setNewMoment]=useState<''|'any'|MomentKind>(''),[ceremony,setCeremony]=useState(''),[createdMoment,setCreatedMoment]=useState('');
 const [setupFriends,setSetupFriends]=useState<string[]>([]),[setupColor,setSetupColor]=useState<string>(GROUP_COLORS.coral),[firstCall,setFirstCall]=useState(false);
 const [footballOn,setFootballOn]=useState(false),[apple,setApple]=useState<{servicesId:string|null;storeUrl:string|null}>({servicesId:null,storeUrl:null}),[saving,setSaving]=useState(false);
 const selectedRound=useRef(''),focused=useRef(''),requestId=useRef('');

 async function load(code:string){const r=await api('/api?invite='+encodeURIComponent(code)+(selectedRound.current?'&round='+encodeURIComponent(selectedRound.current):'')+(focusRef.current?'&question='+encodeURIComponent(focusRef.current):''));const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);void rememberInvite(code);}
 const focusRef=useRef('');
 useEffect(()=>{void api('/api?config').then(r=>r.json()).then(c=>{setPracticeAllowed(!!c.practiceAllowed);setApple({servicesId:c.appleServicesId||null,storeUrl:c.appStoreUrl||null});setFootballOn(!!c.football)}).catch(()=>{})},[]);
 useEffect(()=>{setOrigin(webOrigin());void (async()=>{const params=new URLSearchParams(location.search);focusRef.current=params.get('question')||'';setFocusQuestion(focusRef.current);if(params.get('view')==='winner')setTab('ranking');const code=params.get('invite')||(await lastInvite())||'';selectedRound.current=params.get('round')||'';setInvite(code);if(code)await load(code).catch(e=>setError(e.message));setLoading(false);if(NATIVE)void initNative({onOpen:url=>{void openLink(url)}});})()},[]);
 async function act(payload:Record<string,unknown>,message?:string){setError('');setBusy(true);try{const r=await api('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,invite})});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.session)await setSession(d.session);if(payload.action==='predict'||payload.action==='predictLongterm')void haptic('pick');if(NATIVE&&(payload.action==='join'||payload.action==='create'))void initNative({register:true});if(d.focusTab)setFeatureFocus(v=>({name:d.focusTab,tick:v.tick+1}));if(d.invite){setInvite(d.invite);const next=new URL(location.href);next.searchParams.set('invite',d.invite);history.replaceState(null,'',next);await load(d.invite);}if(d.questionId&&(payload.action==='question'||payload.action==='longterm'))setCreatedId(d.questionId);if(d.momentId)setCreatedMoment(d.momentId);if(message)setNotice(message);return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
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
  const match={home:q.home,away:q.away,kickoff:q.kickoff,league:q.league_name,reason:q.selection_reason,home90:q.home90,away90:q.away90};
  return {...c,market:c.market||q.market,match,text:matchTitle({match,text:c.text})}}),[data?.bets,data?.questions]);const snaps=(data?.snapshots||[]) as Snapshot[];
 const sections=useMemo(()=>sortCalls(calls,me,clock),[calls,me,clock]);
 const findCall=(id:string)=>calls.find(c=>c.id===id);
 const moments=useMemo(()=>((data as {moments?:Moment[]}|null)?.moments||[]),[data]);
 const linkFor=(c:Call)=>origin?(c.share_code?shortLink(origin,c.share_code):shareLink(origin,invite,{questionId:c.id,roundId:c.round_id||undefined})):'';
 const groupLink=origin&&data?.group.share_code?shortLink(origin,data.group.share_code):origin?shareLink(origin,invite):'';

 // Open what a shared link or notification pointed at, once.
 useEffect(()=>{if(!data?.joined||!focusQuestion||focused.current===focusQuestion)return;const c=findCall(focusQuestion);if(!c)return;focused.current=focusQuestion;setTab('calls');
  if(['settled','void'].includes(c.state))setResult(c);else if(clock<Date.parse(c.locks_at)&&c.state==='open'){if(!c.answer&&c.subject_id!==me)startFlow(c)}else setRevealing(c);},[data?.joined,focusQuestion,data?.bets]);
 // After starting a Moment: send it to the group.
 useEffect(()=>{if(!createdMoment)return;const m=moments.find(x=>x.id===createdMoment);if(!m)return;setCreatedMoment('');openShareMoment(m)},[createdMoment,moments]);
 // Right after making a group: straight into the first call.
 useEffect(()=>{if(firstCall&&data?.joined){setFirstCall(false);setFirstOpen(true);setCreating(true)}},[firstCall,data?.joined]);
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
  if(m){const k=kickLabel(m.kickoff||c.locks_at,new Date(),zone);setSharing({title,url,text:`${m.home} – ${m.away}, ${k.charAt(0).toLowerCase()+k.slice(1)}.\n${c.answer?t('I’ve made my call. Have you?'):t('Who wins? Make your call:')} ${url}`,preview:<CallPreview call={{...c,options:null,creator_name:BRAND_NAME}} groupName={data!.group.name} pickers={(c.picker_ids||[]).map(id=>names[id]).filter(Boolean)} foot={(m.league||t('Football'))+' · '+data!.group.name}/>});return}const pickers=(c.picker_ids||[]).map(id=>names[id]).filter(Boolean);const about=c.subject_id?names[c.subject_id]:'';setSharing({title,url,text:about&&!['settled','void'].includes(c.state)?`There’s a secret call about ${about} in ${data!.group.name}. ${about}, don’t look. ${url}`:callText(c,url),preview:cardImage(c)||<CallPreview call={c} groupName={data!.group.name} pickers={pickers}/>,...tagging(c,url)})}
 /** The real WhatsApp picture, straight from the server, so what you see is what they get. */
 function cardImage(c:Call,forName?:string){if(!origin||!c.share_code||(c.subject_id&&!['settled','void'].includes(c.state)))return null;return <img className="c-card-image" alt="" src={origin+'/share/image?c='+c.share_code+(forName?'&for='+encodeURIComponent(forName):'')+'&v='+(c.picked||0)}/>}
 /** One short line in the group's language; the picture does the rest. */
 function callText(c:Call,url:string,forName?:string){const tr=((data!.group as {lang?:string}).lang)==='tr';
  if(forName)return tr?`${forName}, bu soru seni soruyor 👀 ${url}`:`${forName}, this one's about you 👀 ${url}`;
  if(['settled','void'].includes(c.state))return tr?`${c.text} Sonuç belli 👀 ${url}`:`${c.text} The result is in 👀 ${url}`;
  // The preview already shows the question, so the message is just the nudge.
  const who=c.answer_type==='friend';return tr?`${who?'Sen kimi diyorsun?':'Sen ne diyorsun?'} 👀 ${url}`:`${who?'Who’s your pick?':'What’s your call?'} 👀 ${url}`}
 /** Friend calls: send a friend who hasn't joined their own "you were picked" link. */
 function tagging(c:Call,url:string){if(c.answer_type!=='friend'||['settled','void'].includes(c.state))return {};const pending=((data!.group as {pending_names?:string[]}).pending_names)||[];const tags=(c.options||[]).filter(o=>pending.some(p=>p.toLowerCase()===o.toLowerCase()));if(!tags.length)return {};
  const retag=(name:string)=>setSharing(s=>{if(!s)return s;const next=s.tag===name?'':name;const u=next?url+'?for='+encodeURIComponent(next):url;return {...s,tag:next,url:u,text:callText(c,u,next||undefined),preview:cardImage(c,next||undefined)||s.preview}});
  return {tags,retag}}
 /** Go through every open call, one after another, starting from the one you tapped. A Moment's call walks through that Moment. */
 function startFlow(first:Call,preset?:string){if(first.moment_id){const m=moments.find(x=>x.id===first.moment_id);if(m){const rest=momentView(m,calls,Date.now(),me).toPick.map(c=>c.id).filter(id=>id!==first.id);setFlow(first.answer?[first.id]:[first.id,...rest]);setPick({call:first,preset});return}}const open=sortCalls(calls,me,Date.now()).yourTurn.map(c=>c.id).filter(id=>id!==first.id);const ids=!first.answer?[first.id,...open]:[first.id];setFlow(ids);setPick({call:first,preset})}
 function advance(from:Call){const ids=flow||[];const i=ids.indexOf(from.id);const next=ids.slice(i+1).map(id=>findCall(id)).find(c=>c&&!c.answer&&c.state==='open'&&Date.now()<Date.parse(c.locks_at));if(next){setPick({call:next});return true}setPick(null);setFlow(null);return false}
 function openShareMoment(m:Moment){if(!origin||!m.share_code)return;const url=shortLink(origin,m.share_code);const tr=((data!.group as {lang?:string}).lang)==='tr';const done=momentView(m,calls,Date.now(),me).status==='done';
  setSharing({title:done?t('Share the result'):t('Send it to the group'),url,text:done?(tr?`${m.title}: kâhin belli oldu 🔮 ${url}`:`${m.title}: the oracle is in 🔮 ${url}`):(tr?`${m.title} 🎉 Tahminini yap 👀 ${url}`:`${m.title} 🎉 Make your calls 👀 ${url}`),preview:<img className="c-card-image" alt="" src={origin+'/share/image?c='+m.share_code+'&v='+Date.now()}/>})}
 function nextLockAt(){const t=[...calls.filter(c=>c.state==='open'&&!c.fixture_id).map(c=>Date.parse(c.locks_at)),...(data?.questions||[]).filter(q=>(q.market||'custom')!=='custom').map(q=>Date.parse(q.locks_at))].filter(x=>x>clock).sort((a,b)=>a-b);return t[0]}
 async function joinAndPick(name:string,answer:string,p:Preview|null){if(p)focused.current=p.id;const joined=await act({action:'join',name});if(!joined)return;if(!p||!answer){setNotice(t('You’re in. Let’s make it interesting.'));return;}const ok=await act(p.scope==='longterm'?{action:'predictLongterm',questionId:p.id,answer}:{action:'predict',questionId:p.id,answer});if(ok&&!NATIVE&&canApple){setSaving(true);return}setNotice(ok?t('You’re in, and your call is saved.'):t('You’re in. That call isn’t taking picks right now.'));}
 const canApple=NATIVE||!!apple.servicesId;
 /** Sign in with Apple: saves this account (web) or finds it (app, new phone). On the web, then on to the App Store. */
 async function signInApple(){try{const idToken=await appleIdToken(apple.servicesId);if(!idToken)return;if(!await act({action:'appleSignIn',idToken}))return;setSaving(false);if(!NATIVE&&apple.storeUrl){location.href=apple.storeUrl;return}setNotice(NATIVE?t('You’re back in.'):t('Saved. Sign in with Apple in the app and your calls are there.'))}catch(e){setError((e as Error).message)}}
 async function deleteMe(){if(!window.confirm(t('Delete your account? You’ll leave every group, and your name becomes “Deleted player”. This can’t be undone.')))return;setBusy(true);try{const r=await api('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deleteAccount'})});const d=await r.json();if(!r.ok)throw Error(d.error);await forgetAccount();location.href=NATIVE?location.pathname:'/'}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function go(t:Tab){setTab(t);window.scrollTo({top:0});void haptic('tap');}

 // The interface speaks the group's language; before you're in one, the phone's.
 setLang(data?((data.group as {lang?:string}).lang==='tr'?'tr':'en'):deviceLang);
 if(loading)return <main className="c-loading" role="status"><span className="c-brandmark big">{BRAND}</span></main>;

 // Landing: start a group.
 if(!invite)return <main className="c-landing">
  <div className="c-landing-top"><span className="c-brandmark big">{BRAND}</span><span className="c-pill">{t('Free. No money. Ever.')}</span></div>
  <h1>{t('Your friends.')}<br/><em>{t('Your calls.')}</em></h1>
  <p className="c-lead">{t('Make calls about your friends and your plans. See who said what when picks close. The fewer friends who saw it coming, the more you score.')}</p>
  <form className="c-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const practice=f.get('practice')==='1';const payload:Record<string,unknown>={action:'create',name:f.get('name'),groupName:f.get('groupName'),practice,friends:setupFriends,color:setupColor,lang:uiLang(),startNow:!practice};if(!practice&&f.get('groupType'))payload.groupType=f.get('groupType');try{payload.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}const region=navigator.languages?.map(l=>l.split('-')[1]).find(r=>r&&/^[A-Za-z]{2}$/.test(r));if(region)payload.country=region.toUpperCase();void act(payload).then(ok=>{if(ok&&!practice)setFirstCall(true)});}}>
   <h2>{t('Start your group')}</h2>
   <label>{t('Your name')}<input name="name" required maxLength={60} placeholder={t("What do your friends call you?")} autoComplete="given-name"/></label>
   <label>{t('Group name')}<input name="groupName" required maxLength={60} placeholder={t("Agalar, the flat, uni crew…")}/></label>
   <div className="c-swatches" role="radiogroup" aria-label={t("Group colour")}>{Object.entries(GROUP_COLORS).map(([k,c])=><button type="button" key={k} role="radio" aria-checked={setupColor===c} aria-label={k} className={setupColor===c?'on':''} style={{background:c}} onClick={()=>setSetupColor(c)}/>)}</div>
   <FriendNames names={setupFriends} onChange={setSetupFriends}/>
   {footballOn&&<label>{t('What will you call?')}<select name="groupType" defaultValue="Friends"><option value="Friends">{t('Our own calls')}</option><option value="Football">{t('Football matches')}</option><option value="Mixed">{t('Both')}</option></select></label>}
   {practiceAllowed&&<label className="c-check"><input type="checkbox" name="practice" value="1"/><span><b>{t('Practice group')}</b><small>{t('For testing: a whole week in an hour.')}</small></span></label>}
   <button className="c-btn" disabled={busy}>{t('Create group')} <Icon name="arrow"/></button>
   <small>{t('Starts right away. Points are free and can’t be bought or cashed out. For players aged 18 and over.')}</small>
  </form>
  {canApple&&<div className="c-signin"><small>{t('Already made a call?')}</small><AppleButton busy={busy} onClick={()=>void signInApple()}/></div>}
  <LegalLinks/>
  {error&&<p className="c-toast error" role="alert">{error}</p>}
 </main>;

 if(!data)return <main className="c-landing">{error&&<p className="c-toast error" role="alert">{error}</p>}</main>;

 // Opened from a link, not in the group yet: the call comes first.
 if(!data.joined)return <JoinScreen data={data} busy={busy} clock={clock} onJoin={joinAndPick} error={error} notice={notice}/>;

 const practice=!!data.group.practice;
 const roundType=data.selectedRound?.group_type||data.group.group_type||'Friends',limits=(data.group as {instant?:boolean}).instant&&roundType==='Friends'?{...slotLimits(roundType),custom:50}:slotLimits(roundType),zone=data.selectedRound?.timezone||data.group.timezone||'UTC';
 // Football is switched off (FOOTBALL=on brings it back); a running football week just shows its own calls.
 const football=footballOn&&roundType!=='Friends';
 const start=data.group.opens_at?new Date(data.group.opens_at):null;
 const active=!!start&&clock>=start.getTime()&&(!data.selectedRound||(data.selectedRound.state==='live'&&data.selectedRound.content_ready!==false&&data.currentRoundId===data.selectedRound.id));
 const customUsed=data.questions.filter(q=>(q.market||'custom')==='custom').length;
 const cutoff=start?period(start,roundType,zone,practice).customCutoff.getTime():0;
 const weeklyOpen=active&&limits.custom>0&&customUsed<limits.custom&&clock<=cutoff;
 const weeklyWhy=data.members<3?'This week’s calls start once three friends are in. Later works now.':customUsed>=limits.custom?`This week already has ${limits.custom} calls. Try Later.`:!active?(start&&clock<start.getTime()?'This week opens '+when(start,clock,zone)+'. Later works now.':'This week has wrapped up. Later works now.'):'Adding calls has closed for this week. Try Later.';
 const canPickFootball=!!data.selectedRound&&['live','provisional'].includes(data.selectedRound.state)&&data.selectedRound.content_ready!==false&&clock<=Date.parse(data.selectedRound.pick_end_at||'');
 const unread=data.notifications?.filter(n=>!n.read_at).length||0;
 const myRow=data.boards?.month.find(s=>s.user_id===me);const anyPoints=!!data.boards?.month.some(s=>s.points_tenths>0);
 const nextLock=nextLockAt();
 const activeMoments=moments.filter(m=>{const v=momentView(m,calls,clock,me);return v.status!=='done'||clock-Date.parse(m.starts_at)<3*86400000}).sort((x,y)=>{const dx=momentView(x,calls,clock,me).status==='done'?1:0,dy=momentView(y,calls,clock,me).status==='done'?1:0;return dx-dy||Date.parse(x.starts_at)-Date.parse(y.starts_at)});
 // New Year: from November, nudge each group to seal its predictions for next year (once).
 const yearCampaign=new Date(clock).getMonth()>=10&&!moments.some(m=>m.kind==='year'&&clock-Date.parse(m.created_at)<120*86400000);
 const momentPicks=activeMoments.reduce((n,m)=>n+momentView(m,calls,clock,me).toPick.length,0);
 const instant=!!(data.group as {instant?:boolean}).instant;
 const status=data.members<3&&!instant?'Waiting for '+(3-data.members)+' more '+(3-data.members===1?'friend':'friends'):start&&clock<start.getTime()?'First week opens '+when(start,clock,zone):!active?'This week has wrapped up':(sections.yourTurn.length+momentPicks?L((sections.yourTurn.length+momentPicks)+(sections.yourTurn.length+momentPicks===1?' call':' calls')+' waiting for you',(sections.yourTurn.length+momentPicks)+' tahmin seni bekliyor'):L('You’re all caught up','Her şey tamam'))+(nextLock?L(' · next lock in ',' · sıradaki kilit ')+countdown(nextLock,clock):'');
 const lastFinal=(data.rounds||[]).find(r=>r.state==='final'&&r.winners.length>0);
 const liveEmpty=!!data.selectedRound&&data.selectedRound.state!=='final'&&data.selectedRound.standings.every(x=>x.points_tenths===0);
 const board=(data.rounds||[]).find(r=>r.id===boardRound)||(liveEmpty&&lastFinal?lastFinal:data.selectedRound);
 const judgeFor=new Set((data.alerts||[]).filter(a=>a.stage==='judgment requested'&&a.question_id).map(a=>a.question_id!));
 const ctx:CallsCtx={me,meName,names,now:clock,snaps,admin:!!members.find(m=>m.user_id===me)?.admin,activeIds:new Set(members.filter(m=>m.active).map(m=>m.user_id)),judgeFor,disputeMs:data.timing?.disputeMs||86400000,busy,adminId:members.find(m=>m.admin)?.user_id||'',people:members.filter(m=>m.active).map(m=>({id:m.user_id,name:m.name}))};
 const a:CallsAct={pick:(c,ans)=>startFlow(c,ans),reveal:setRevealing,result:c=>{markSeen(c.id);setResult(c)},resolve:(c,mode)=>setResolving({call:c,mode}),dispute:c=>{if(window.confirm(t('Say the result isn’t right? A friend who stayed out of it will decide.')))void act({action:'dispute',questionId:c.id},t('Got it. A friend will decide.'))},share:c=>openShare(c),setResolver:(c,id)=>{void act({action:'setResolver',questionId:c.id,targetId:id},(id===me?t('You'):names[id]||t('They'))+t(' will say what happened.'))}};
 const myCareer=data.careers?.find(c=>c.user_id===me);
 const footballQs=data.questions.filter(q=>(q.market||'custom')!=='custom');
 const stepOf=pick&&flow&&flow.length>1?{n:flow.indexOf(pick.call.id)+1,of:flow.length}:undefined;
 // Matches are in the list above. Here: only "waiting for matches" and next week's preview.
 const waitingMatches=football&&!footballQs.length&&data.selectedRound?.state==='waiting_feed';
 const footballBlock=football&&(waitingMatches||data.comingUp)?<>{waitingMatches&&<section className="c-card coming"><span className="c-badge later">{t('Matches')}</span><h3>{t('This week’s matches are on their way')}</h3><p className="c-sub">{t('They show up here as soon as they’re published.')}</p></section>}{data.comingUp&&<ComingUp c={data.comingUp} zone={zone} now={clock}/>}</>:null;
 const openMoment=moments.find(m=>m.id===momentId)||null;
 const nothing=!sections.yourTurn.length&&!sections.locked.length&&!sections.inIt.length&&!sections.later.length&&!sections.results.length&&!football&&!activeMoments.length;
 const groupLang:'tr'|'en'=(data.group as {lang?:string}).lang==='tr'?'tr':'en';
 const pendingNames=((data.group as {pending_names?:string[]}).pending_names)||[];
 const friendNames=[...members.filter(m=>m.active).map(m=>m.name),...pendingNames.filter(n=>!members.some(m=>m.active&&m.name.toLowerCase()===n.toLowerCase()))];
 const others=members.filter(m=>m.active&&m.user_id!==me).map(m=>({id:m.user_id,name:m.name}));

 return <div className="c-shell">
  <header className={'c-top'+(tab==='calls'?'':' compact')}>
   <div className="c-top-row">
    <div className="c-top-main"><span className="c-top-kicker">{practice?<b className="c-practice">{t('Practice · a week in an hour')}</b>:data.members===1?t('Just you so far'):data.members+L(' friends',' arkadaş')}</span><h1>{data.group.name}</h1>{tab==='calls'&&<Faces names={members.filter(m=>m.active).map(m=>m.name)} size={26} ring="#17201B" max={7}/>}</div>
    <div className="c-top-side"><button className="c-bell" aria-label={unread?unread+' unread notifications':t('Notifications')} onClick={()=>{go('group');setNotificationFocus(n=>n+1)}}><Icon name="bell" size={20}/>{unread>0&&<i>{unread}</i>}</button>
     <button className="c-rank" onClick={()=>go('ranking')} aria-label={t("Ranking")}>{myRow&&anyPoints?<><b>#{myRow.rank}</b><span>{L('this month','bu ay')}</span></>:<><b>{sections.yourTurn.length+momentPicks}</b><span>{L('to call','bekliyor')}</span></>}</button></div>
   </div>
   {tab==='calls'&&<p className="c-top-status">{status}</p>}
  </header>

  <main className="app c-main">
  {tab==='calls'&&<>
   {data.members<3&&<section className="c-card invite"><h3>{(data.group as {instant?:boolean}).instant?t('Now get them in'):t('Good calls need good company.')}</h3><p>{(data.group as {instant?:boolean}).instant?t('Share a call in your group chat. Friends tap it, claim their name and pick, no sign-up.'):`Get ${3-data.members} more ${data.members===2?'friend':'friends'} in and the week starts. Later calls work already.`}</p><button className="c-btn" onClick={()=>setSharing({title:t('Invite friends'),url:groupLink,text:shareText(inviteCard(data.group.name,members.map(m=>m.name)),groupLink,meName)})}><Icon name="share"/> {t('Invite friends')}</button></section>}
   {football&&!practice&&data.selectedRound?.state==='skipped'&&clock<Date.parse(data.selectedRound.pick_end_at||'')&&members.find(m=>m.user_id===me)?.admin&&<section className="c-card starter"><span className="c-kicker dark">{t('This week')}</span><h3>{t('No matches were published in time')}</h3><p>{t('Added some since? Open this week now with them.')}</p><button className="c-btn" disabled={busy} onClick={()=>void act({action:'startFirstWeek'},t('This week is on. Make your calls.'))}>{t('Open this week now')}</button></section>}
   {data.members>=3&&start&&clock<start.getTime()&&!practice&&<section className="c-card starter"><span className="c-kicker dark">{t('First week')}</span><h3>{t('Starts')} {when(start,clock,zone)}</h3>{members.find(m=>m.user_id===me)?.admin?<><p>{t('Don’t want to wait? Start a short first week now. It runs until then, and the normal weeks follow.')}</p><button className="c-btn" disabled={busy} onClick={()=>{if(window.confirm(t('Start the first week now? Everyone can make their calls straight away.')))void act({action:'startFirstWeek'},t('The first week is on. Make your calls.'))}}>{t('Start the first week now')}</button></>:<p>{t('The admin can start it early. Until then, you can look around.')}</p>}</section>}
   {activeMoments.length>0&&<div className="c-moments">{activeMoments.map(m=><MomentCard key={m.id} m={m} calls={calls} me={me} names={names} now={clock} lang={groupLang} onOpen={()=>setMomentId(m.id)} onPick={()=>{const first=momentView(m,calls,clock,me).toPick[0];if(first)startFlow(first)}}/>)}</div>}
   <CallsList s={sections} ctx={ctx} act={a} football={footballBlock}/>
   {yearCampaign&&<button className="c-idea-row" onClick={()=>setNewMoment('year')}><span aria-hidden="true">🔮</span><span><b>{t('Predictions for')} {new Date(clock).getFullYear()+1}</b><small>{t('Seal them now, open them together next New Year.')}</small></span><Icon name="arrow" size={18}/></button>}
   {nothing&&<div className="c-empty"><h2>{t('Start the first “told you so”')}</h2><p>{t('Make a call about anything: the weekend, the derby, who’s late. Right calls earn points; bold ones earn more. Free, always.')}</p><button className="c-btn" onClick={()=>setCreating(true)}><Icon name="plus"/> {t('New call')}</button></div>}
   {plusOpen&&<div className="c-plus-scrim" onClick={()=>setPlusOpen(false)}/>}
   <div className={'c-fab-row'+(plusOpen?' open':'')}>{plusOpen&&<div className="c-plus-menu"><button onClick={()=>{setPlusOpen(false);setCreating(true)}}><span aria-hidden="true">💬</span><span><b>{t('A call')}</b><small>{t('One question for the group')}</small></span></button><button onClick={()=>{setPlusOpen(false);setNewMoment('any')}}><span aria-hidden="true">✨</span><span><b>{t('A Moment')}</b><small>{t('A few calls for a trip, birthday, night out')}</small></span></button></div>}<button className="c-fab" aria-expanded={plusOpen} aria-label={t("New")} onClick={()=>setPlusOpen(!plusOpen)}><Icon name={plusOpen?'close':'plus'} stroke={2.6}/> {plusOpen?t('Close'):t('New')}</button></div>
  </>}

  {tab==='ranking'&&<RankingTab boards={data.boards} me={me} meName={meName} calls={calls} snaps={snaps} careers={data.careers||[]} names={names} onProfile={setProfile} onShareOracle={(who,month)=>setSharing({title:t('Share the Oracle'),url:groupLink,text:L(`👑 ${who} called ${month} best in ${data.group.name}. Think you can do better?\n${groupLink}`,`👑 ${data.group.name} grubunda ${month} ayını en iyi ${who} bildi. Daha iyisini yapabilir misin?\n${groupLink}`)})}/>}

  {tab==='group'&&<>
   <section className="c-card group-invite"><span className="c-kicker dark">{t('Your group')}</span><div className="c-group-line"><Faces names={members.filter(m=>m.active).map(m=>m.name)} size={30}/><p>{L(data.members+' '+(data.members===1?'friend':'friends')+' · up to 30',data.members+' arkadaş · en fazla 30')}</p></div>
    <button className="c-btn" onClick={()=>setSharing({title:t('Invite friends'),url:groupLink,text:shareText(inviteCard(data.group.name,members.map(m=>m.name)),groupLink,meName)})}><Icon name="share"/> {t('Invite friends')}</button>
    <div className="c-notin"><span className="c-label">{t('Not in yet')}</span><p className="c-sub">{t('They claim their name from your link. “Who…?” calls can pick them already.')}</p><AddNames names={pendingNames} busy={busy} onAdd={names=>act({action:'addNames',names},t('Added.'))}/></div></section>
   {canApple&&data.linked===false&&<section className="c-card save"><span className="c-kicker dark">{t('Your account')}</span><h3>{t('Don’t lose your calls')}</h3><p className="c-sub">{t('Sign in with Apple to keep your calls, points and level on any phone, and to pick up where you left off in the app.')}</p><AppleButton busy={busy} onClick={()=>void signInApple()}/></section>}
   {footballOn&&<FootballPanel data={data} act={p=>act(p)} busy={busy}/>}
   <PastMoments moments={moments} calls={calls} snaps={snaps} now={clock} meName={meName} onOpen={m=>setMomentId(m.id)}/>
   <LifecyclePanel view="group" featureFocus={featureFocus} notificationFocus={notificationFocus} data={data} act={p=>act(p,t('Saved.'))} busy={busy} shareContext={{groupName:data.group.name,invite,origin,demo:!!data.demoNow}}/>
   <HowItWorks/>
   <LegalLinks/>
   <button className="c-link c-danger-link" disabled={busy} onClick={()=>void deleteMe()}>{t('Delete my account')}</button>
  </>}
  </main>

  {error&&<p className="c-toast error" role="alert" onClick={()=>setError('')}>{error}</p>}{notice&&<p className="c-toast" role="status">{notice}</p>}
  <nav className="c-tabbar" aria-label={t("Sections")}>{TABS.map(tb=><button key={tb.id} className={tab===tb.id?'on':''} aria-current={tab===tb.id?'page':undefined} onClick={()=>go(tb.id)}><span className="c-tab-icon"><Icon name={tb.icon} size={22}/></span><span>{t(tb.label)}</span></button>)}</nav>

  <MomentSheet m={openMoment} calls={calls} snaps={snaps} me={me} meName={meName} names={names} now={clock} lang={groupLang} onClose={()=>setMomentId('')} onPick={c=>{const v=openMoment&&momentView(openMoment,calls,clock,me);const first=c||v?.toPick[0];if(first)startFlow(first)}} onReveal={setRevealing} onResolve={c=>setResolving({call:c,mode:'set'})} onResult={c=>{markSeen(c.id);setResult(c)}} onShare={()=>{if(openMoment)openShareMoment(openMoment)}} friends={friendNames} busy={busy} onAdd={call=>act({action:'addMomentCall',momentId:openMoment!.id,call},t('Added. Everyone can seal an answer now.'))} onCeremony={()=>{if(openMoment)setCeremony(openMoment.id)}} canSet={c=>!!openMoment?.sealed||canSettle(c,ctx)}/>
  <OpeningSheet m={moments.find(x=>x.id===ceremony)||null} calls={calls} snaps={snaps} meName={meName} now={clock} onResolve={c=>setResolving({call:c,mode:'set'})} onClose={()=>setCeremony('')}/>
  <PickSheet call={pick?.call||null} preset={pick?.preset} step={stepOf} onSkip={()=>{if(pick)advance(pick.call)}} names={names} longCount={data.longTermCount||0} now={clock} busy={busy} onClose={()=>{setPick(null);setFlow(null)}} onSave={async(c,answer)=>{const inFlow=!!stepOf&&stepOf.n<stepOf.of;const ok=await act(c.scope==='longterm'?{action:'predictLongterm',questionId:c.id,answer}:{action:'predict',questionId:c.id,answer},inFlow?undefined:c.answer?t('Updated.'):stepOf?t('All done. You’ll see how the group is split on each call.'):t('You’re in. Tap the call to see how the group is split.'));if(ok&&inFlow)advance(c);return ok}}/>
  <RevealSheet call={revealing} snaps={snaps} me={me} meName={meName} onClose={()=>setRevealing(null)}/>
  <ResultSheet call={result} snaps={snaps} meName={meName} onClose={()=>setResult(null)} onShare={(c,text)=>{const url=linkFor(c);setResult(null);setSharing({title:t('Rub it in'),url,text:text+' '+url})}}/>
  <ResolveSheet call={resolving?.call||null} mode={resolving?.mode||'set'} busy={busy} onClose={()=>setResolving(null)} onPick={(c,answer)=>act({action:resolving?.mode==='judge'?'judge':'propose',questionId:c.id,answer},resolving?.mode==='judge'?t('Decided. It counts now.'):t('Result set. Everyone has a day to say if it’s not right.'))}/>
  <NewCallSheet isAdmin={ctx.admin} open={creating} first={firstOpen} lang={groupLang} friendNames={friendNames} now={clock} practice={practice} weeklyOpen={weeklyOpen} weeklyWhy={weeklyWhy} deadline={data.selectedRound?Date.parse(data.selectedRound.deadline_at):null} members={others} busy={busy} onClose={()=>{setCreating(false);setFirstOpen(false)}} onCreate={(c:NewCall)=>{const payload:Record<string,unknown>={...c};if(c.action==='question'){requestId.current||=crypto.randomUUID();payload.requestId=requestId.current}return act(payload).then(ok=>{if(ok)requestId.current='';return ok})}}/>
  {saving&&<Sheet open label={t("Save your call")} onClose={()=>setSaving(false)}><div className="c-save"><span className="c-kicker dark">{t('Your call is in')}</span><h2>{t('Save it and get the app')}</h2>
   <ul><li><Icon name="check" size={18} stroke={2.6}/>{t('See how the group splits the moment picks close')}</li><li><Icon name="check" size={18} stroke={2.6}/>{t('A nudge when friends make their calls')}</li><li><Icon name="check" size={18} stroke={2.6}/>{t('Your calls, points and level on any phone')}</li></ul>
   <AppleButton busy={busy} onClick={()=>void signInApple()}>{apple.storeUrl?t('Sign in with Apple & get the app'):t('Sign in with Apple')}</AppleButton>
   <p className="c-hint">{apple.storeUrl?t('In the app, sign in with Apple again: your call will be there.'):t('Later, sign in with Apple in the app and your call will be there.')}</p>
   <button className="c-link" onClick={()=>{setSaving(false);setNotice(t('You’re in, and your call is saved.'))}}>{t('Not now')}</button></div></Sheet>}
  <NewMomentSheet open={!!newMoment} preset={newMoment&&newMoment!=='any'?newMoment:undefined} now={clock} lang={groupLang} friends={friendNames} busy={busy} onClose={()=>setNewMoment('')} onCreate={(m:NewMoment)=>act({action:'createMoment',moment:m})}/>
  <ProfileSheet c={data.careers?.find(c=>c.user_id===profile)||null} name={names[profile]||''} me={profile===me} onClose={()=>setProfile('')}/>
  <LevelUpSheet c={levelUp&&myCareer?myCareer:null} from={levelUp} onClose={()=>setLevelUp('')} onShare={()=>{const url=groupLink;setLevelUp('');if(myCareer)setSharing({title:t('Tell the group'),url,text:`Just levelled up to ${myCareer.level.name} in ${data.group.name} (${myCareer.points.toLocaleString('en-GB')} career points). ${url}`})}}/>
  <ShareSheet open={!!sharing} title={sharing?.title||''} text={sharing?.text||''} url={sharing?.url||''} preview={sharing?.preview} tags={sharing?.tags} tag={sharing?.tag} onTag={sharing?.retag} onClose={()=>setSharing(null)} onDone={m=>{setNotice(m);setSharing(null)}}/>
 </div>;
}

/** Next week's matches as soon as they're published: look now, pick from Thursday 12:00. */
function ComingUp({c,zone,now}:{c:NonNullable<GroupView['comingUp']>;zone:string;now:number}){
 const fmt=(t:string)=>new Date(t).toLocaleString('en-GB',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit'});
 return <section className="c-card coming"><div className="c-card-top"><span className="c-badge later">{t('Picks open')} {when(c.opensAt,now,zone)}</span><span className="c-by">{c.matches.length} matches</span></div><h3>{t('Matches coming up')}</h3>
  <div className="c-coming">{c.matches.map(m=><div key={m.home+m.kickoff} className="c-coming-row"><span className="c-coming-time">{fmt(m.kickoff)}</span><span className="c-coming-teams"><b>{m.home} – {m.away}</b><small>{m.reason}</small></span></div>)}</div></section>;
}

function JoinScreen({data,busy,clock,onJoin,error,notice}:{data:GroupView;busy:boolean;clock:number;onJoin:(name:string,answer:string,p:Preview|null)=>void;error:string;notice:string}){
 const p=data.preview||null;const [answer,setAnswer]=useState(''),[name,setName]=useState(''),[other,setOther]=useState(false);
 const pending=data.pendingNames||[],claimed=!other&&pending.includes(name);
 const pickedMe=claimed&&p?.pickedYou?(Object.entries(p.pickedYou).find(([k])=>k.toLowerCase()===name.toLowerCase())?.[1]||0):0;
 const locked=!!p&&(clock>=Date.parse(p.locks_at)||p.state!=='open');const long=p?.scope==='longterm';
 const people=data.memberNames||[];
 const opts=p?.answers||(p?answersOf(p).map(a=>({value:a,label:label(a,p)})):[]);
 return <main className="c-join">
  <div className="c-join-top"><span className="c-brandmark">{BRAND}</span><span>{t('Free · no money, ever')}</span></div>
  {p?<>
   <div className="c-join-from">{p.creator_name&&!p.answers&&<Face name={p.creator_name} size={48} ring="#FFFFFF"/>}<p>{p.answers?<>{t('Your friends in')} <b>{data.group.name}</b> want your call</>:<><b>{p.creator_name||t('A friend')}</b> wants your call in <b>{data.group.name}</b></>}</p></div>
   <section className="c-join-card">
    <div className="c-card-top"><span className={'c-badge '+(long?'later':'soon')}>{locked?t('Picks are closed'):long&&p.event_at?t('We’ll know in ')+new Date(p.event_at).toLocaleDateString('en-GB',{month:'long'}):t('Picks close ')+when(p.locks_at,clock)}</span><span className="c-by"><Faces names={people} size={22} max={4}/> {data.members} in</span></div>
    <h1>{p.text}</h1>
    {!locked&&<>{p.answer_type==='friend'?<FacePicker names={opts.map(o=>o.value)} value={answer} onPick={setAnswer} big/>:<div className={'c-options'+(opts.length>2?' stack':' pair')} role="radiogroup" aria-label={t("Your answer")}>{opts.map(o=><button key={o.value} role="radio" aria-checked={answer===o.value} className={'c-opt big'+(answer===o.value?' on':'')} onClick={()=>setAnswer(o.value)}><span>{o.label}</span>{answer===o.value&&<Icon name="check" size={20} stroke={2.6}/>}</button>)}</div>}
     <p className="c-hint">{t('You’ll see what everyone said when picks close.')}</p></>}
   </section>
  </>:<>
   <div className="c-join-from big"><p>{t('You’re invited to')}</p><h1>{data.group.name}</h1><Faces names={people} size={40} ring="#17201B"/><p>{people.length?people.slice(0,3).join(', ')+(people.length>3?L(' and '+(people.length-3)+' more',' ve '+(people.length-3)+' kişi daha'):'')+L(' '+(people.length===1?'is':'are')+' in.',' grupta.'):''}</p></div>
   <ol className="c-join-how"><li><span><b>{t('Calls about you all.')}</b> {t('Who’s late, who marries last, does the trip happen.')}</span></li><li><span><b>{t('Pick before it closes.')}</b> {t('Nobody sees answers until then.')}</span></li><li><span><b>{t('Bold calls score more.')}</b> {t('The fewer friends who saw it coming, the more you get.')}</span></li></ol>
  </>}
  <form className="c-join-form" onSubmit={e=>{e.preventDefault();onJoin(name.trim(),locked?'':answer,p)}}>
   {pending.length>0&&!other&&<section className="c-claim"><p>{t('Which one are you?')}</p><div className="c-chips">{pending.map(n=><button type="button" key={n} className={'c-chip-name'+(name===n?' on':'')} aria-pressed={name===n} onClick={()=>setName(n)}><Face name={n} size={28}/>{n}</button>)}<button type="button" className="c-chip-name ghost" onClick={()=>{setOther(true);setName('')}}>{t('Someone else')}</button></div>
   {pickedMe>0&&<div className="c-picked-you"><b>{pickedMe===1?t('A friend picked you'):pickedMe+L(' friends picked you',' arkadaşın seni seçti')}</b> {t('in this one. Make your own pick to see the rest when picks close.')}</div>}</section>}
   {(!pending.length||other)?<><label htmlFor="join-name">{t('What do your friends call you?')}</label>
   <input id="join-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={60} placeholder={t("Your name")} autoComplete="given-name"/></>:null}
   <button className="c-btn" disabled={busy||!name.trim()||(!!p&&!locked&&!answer)}>{p&&!locked?(answer?t('I’m in: ')+(opts.find(o=>o.value===answer)?.label||label(answer)):t('Pick an answer first')):name.trim()?L('Join as '+name.trim(),name.trim()+' olarak katıl'):t('Tap your name')}</button>
   <small>{t('No sign-up. Free: points are only for being right, never bought or cashed out. 18+.')}</small>
  </form>
  {error&&<p className="c-toast error" role="alert">{error}</p>}{notice&&<p className="c-toast" role="status">{notice}</p>}
 </main>;
}

/** Privacy, terms and help live on the website, also from inside the app. */
function LegalLinks(){const base=webOrigin();return <nav className="c-footer-links"><a href={base+'/privacy'} target="_blank" rel="noreferrer">{t('Privacy')}</a><a href={base+'/terms'} target="_blank" rel="noreferrer">{t('Terms')}</a><a href={base+'/support'} target="_blank" rel="noreferrer">{t('Help')}</a></nav>}

/** The phone's language decides the group's: Turkish phones get Turkish cards and examples. */
export function uiLang():'tr'|'en'{try{return (navigator.languages?.[0]||navigator.language||'en').toLowerCase().startsWith('tr')?'tr':'en'}catch{return 'en'}}
/** "Who's in?": first names only, as chips. They claim their name when they open your link. */
function FriendNames({names,onChange}:{names:string[];onChange:(n:string[])=>void}){
 const [draft,setDraft]=useState('');
 const add=()=>{const n=draft.trim().replace(/,$/,'');if(n&&!names.some(x=>x.toLowerCase()===n.toLowerCase())&&names.length<29)onChange([...names,n.slice(0,60)]);setDraft('')};
 return <div className="c-friends"><span className="c-flabel">{t('Who’s in?')} <small>{t('First names. They’ll claim theirs from your link.')}</small></span>
  <div className="c-chips">{names.map(n=><button type="button" key={n} className="c-chip-name" onClick={()=>onChange(names.filter(x=>x!==n))} aria-label={t('Remove ')+n}><Face name={n} size={24}/>{n}<i aria-hidden="true">×</i></button>)}
   <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();add()}}} onBlur={add} placeholder={names.length?t('Add another'):t('Ege, Can, Deniz…')} maxLength={60} aria-label={t("Add a friend’s name")}/></div></div>;
}

/** Group tab: friends who haven't joined yet, and adding more. */
function AddNames({names,busy,onAdd}:{names:string[];busy:boolean;onAdd:(n:string[])=>Promise<boolean>}){
 const [draft,setDraft]=useState('');
 const add=async()=>{const list=draft.split(',').map(s=>s.trim()).filter(Boolean);if(!list.length)return;if(await onAdd(list))setDraft('')};
 return <><div className="c-chips">{names.map(n=><span key={n} className="c-chip-name static"><Face name={n} size={24}/>{n}</span>)}</div>
  <div className="c-form-row"><input className="c-input" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void add()}}} placeholder={t("Ege, Can…")} maxLength={200} aria-label={t("Friends’ names")}/><button className="c-btn small" disabled={busy||!draft.trim()} onClick={()=>void add()}>{t('Add')}</button></div></>;
}
