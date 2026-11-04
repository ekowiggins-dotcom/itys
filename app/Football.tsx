'use client';
import {LEAGUES} from '../lib/locale';
import {BRAND_NAME} from '../lib/brand';
import {when} from './format';
import {useState} from 'react';import type {Fixture,GroupType,Market} from '../lib/football/rules';import {slotLimits} from '../lib/football/rules';
export type FootballQuestion={options?:string[]|null;moderation_state?:string;id:string;text:string;locks_at:string;answer:string|null;stake:number|null;picked:number;market?:Market;slot?:string;fixture_id?:string|null;home?:string;away?:string;home90?:number|null;away90?:number|null;league_name?:string;kickoff?:string;state?:string;result_answer?:string|null;void_reason?:string|null;selection_reason?:string};
export type FootballData={group:{group_type?:GroupType;timezone?:string;country?:string;leagues?:number[];pending_settings?:{groupType:GroupType;timezone:string;leagues:number[]}|null};selectedRound?:{id:string;group_type?:GroupType;timezone?:string;leagues?:number[];state:string;content_ready?:boolean};fixtureCatalog?:Fixture[];leagueCatalog?:{id:number;name:string;country:string}[];feedStatus?:{error?:string|null;last_success?:string;connected?:boolean};questions:FootballQuestion[];groupMembers?:{user_id:string;admin:boolean}[];user?:{id?:string};demoNow?:number};
/** Group tab: this week's matches at a glance, plus the admin's football settings. Picking happens in the Calls list. */
export default function FootballPanel({data,act,busy}:{data:FootballData;act:(p:Record<string,unknown>)=>Promise<boolean>;busy:boolean}){
 const admin=data.groupMembers?.some(m=>m.user_id===data.user?.id&&m.admin),r=data.selectedRound,type=r?.group_type||data.group.group_type||'Friends',football=type!=='Friends';
 const [extra,setExtra]=useState(''),[outgoing,setOutgoing]=useState(''),[incoming,setIncoming]=useState(''),[groupType,setGroupType]=useState<GroupType>(data.group.pending_settings?.groupType||data.group.group_type||'Mixed'),[zone,setZone]=useState(data.group.pending_settings?.timezone||data.group.timezone||'UTC'),[leagues,setLeagues]=useState<number[]>(data.group.pending_settings?.leagues||data.group.leagues||[]);
 const clock=data.demoNow||Date.now(),catalog=data.fixtureCatalog||[],limits=slotLimits(type);
 const matches=data.questions.filter(q=>q.fixture_id&&q.market==='result'),extraCount=matches.filter(q=>q.slot==='extra').length;
 const activeIds=new Set(data.questions.map(q=>q.fixture_id)),available=catalog.filter(f=>!activeIds.has(f.id)&&f.status==='scheduled'&&Date.parse(f.kickoff)>clock);
 const leagueCatalog=Object.values(LEAGUES).map(l=>({id:l.id,name:l.name,country:l.country}));
 const manual=!!(data.feedStatus as {manual?:boolean}|undefined)?.manual;
 const open=!!r&&r.content_ready!==false&&!['final','skipped','planned','waiting_feed'].includes(r.state);
 const opt=(f:Fixture)=><option key={f.id} value={f.id}>{f.home} – {f.away} · {when(f.kickoff,clock)}</option>;
 if(!football&&!admin)return null;
 return <section className="c-card football">
  <span className="c-kicker dark">Football</span>
  {football?<><h3>{matches.length?matches.length+(matches.length===1?' match':' matches')+' this week':r?.state==='waiting_feed'?'This week’s matches are on their way':'No matches this week'}</h3>
   <p className="c-sub">{data.demoNow?'Sample matches, not live results.':manual?'Picked by the '+BRAND_NAME+' team: Turkish clubs first, then the biggest games. Results come in after full time.':data.feedStatus?.connected?'Updated automatically.':'Match updates are paused. Results will come in once they’re back.'}</p>
   {matches.length>0&&<ul className="c-fixtures">{matches.map(q=><li key={q.id}><b>{q.home} – {q.away}</b><small>{q.league_name}{q.kickoff?' · '+when(q.kickoff,clock):''}</small></li>)}</ul>}</>
  :<h3>Add football to this group</h3>}

  {football&&open&&limits.extra>0&&available.length>0&&<details className="c-more"><summary>Add a match ({extraCount}/{limits.extra})</summary>
   <p className="c-sub">Anyone can add a match from this week’s list.</p>
   <div className="c-form-row"><select value={extra} onChange={e=>setExtra(e.target.value)} aria-label="Match to add"><option value="">Choose a match</option>{available.map(opt)}</select>
   <button className="c-btn small" disabled={busy||!extra||extraCount>=limits.extra} onClick={()=>act({action:'footballExtra',roundId:r?.id,fixtureId:extra})}>{extraCount>=limits.extra?'All added':'Add'}</button></div></details>}

  {football&&admin&&open&&<details className="c-more"><summary>Swap a match</summary>
   <p className="c-sub">Only before kick-off. Picks on the old match are cleared and people are told.</p>
   <select value={outgoing} onChange={e=>setOutgoing(e.target.value)} aria-label="Match to take out"><option value="">Take out…</option>{matches.filter(q=>q.slot!=='extra'&&Date.parse(q.locks_at)>clock).map(q=><option value={q.fixture_id!} key={q.id}>{q.home} – {q.away}</option>)}</select>
   <div className="c-form-row"><select value={incoming} onChange={e=>setIncoming(e.target.value)} aria-label="Match to put in"><option value="">Put in…</option>{available.filter(f=>(r?.leagues||data.group.leagues||[203]).includes(f.league_id)).map(opt)}</select>
   <button className="c-btn small" disabled={busy||!incoming||!outgoing} onClick={()=>act({action:'footballSwap',roundId:r!.id,outgoingId:outgoing,fixtureId:incoming})}>Swap</button></div></details>}

  {admin&&<details className="c-more"><summary>{football?'Group settings':'Set up football'}</summary>
   {data.group.pending_settings&&<p className="c-sub">From next week: {data.group.pending_settings.groupType==='Football'?'football only':data.group.pending_settings.groupType==='Mixed'?'football and your own calls':'your own calls only'} · {data.group.pending_settings.timezone}.</p>}
   <form className="c-settings" onSubmit={e=>{e.preventDefault();void act({action:'footballSettings',groupType,timezone:zone,country:'TR',leagues})}}>
    <label>What you call<select value={groupType} onChange={e=>setGroupType(e.target.value as GroupType)}><option value="Friends">Your own calls</option><option value="Football">Football matches</option><option value="Mixed">Both</option></select></label>
    <label>Time zone<select value={zone} onChange={e=>setZone(e.target.value)}><option value="Europe/Istanbul">Türkiye</option><option value="Europe/London">UK</option><option value="Europe/Madrid">Spain</option><option value="UTC">UTC</option></select></label>
    <fieldset><legend>Leagues</legend>{leagueCatalog.map(l=><label className="c-check" key={l.id}><input type="checkbox" checked={leagues.includes(l.id)} onChange={e=>setLeagues(e.target.checked?[...leagues,l.id]:leagues.filter(id=>id!==l.id))}/><span>{l.name}</span></label>)}</fieldset>
    <small>Changes start next week. Football weeks run Thursday 12:00 to Thursday: European nights and the weekend’s league games.</small>
    <button className="c-btn" disabled={busy||!leagues.length}>Save for next week</button>
   </form></details>}
 </section>;
}
