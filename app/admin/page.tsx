'use client';
import {useEffect,useState} from 'react';
// Operator page for the manual match list (FOOTBALL_FEED=manual). Needs ADMIN_KEY. Not linked from the app.
type Match={id:string;league_name:string;home:string;away:string;kickoff:string;status:string;home90:number|null;away90:number|null;round_name?:string|null;provider:string;featured:number};
type State={manual:boolean;matches:Match[];preview:{id:string;reason:string;block:string;motw:boolean}[]};
const EXAMPLE='# date time (Istanbul) | league | home | away | round (optional)\n# leagues: SL, EPL, LALIGA, SERIEA, BUNDES, UCL, UEL, UECL\n2026-11-08 20:00 | SL | Galatasaray | Fenerbahçe\n2026-11-08 19:30 | EPL | Arsenal | Chelsea';

export default function Admin(){
 const [key,setKey]=useState(''),[state,setState]=useState<State|null>(null),[text,setText]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[scores,setScores]=useState<Record<string,{h:string;a:string}>>({});
 useEffect(()=>{try{const k=sessionStorage.getItem('calld.admin');if(k){setKey(k);void load(k)}}catch{}},[]);
 async function call(k:string,init?:RequestInit){setBusy(true);setMsg('');try{const r=await fetch('/api/admin',{...init,headers:{'Content-Type':'application/json','x-admin-key':k}});const d=await r.json();if(!r.ok)throw Error(d.error);setState(d);return d}catch(e){setMsg((e as Error).message);return null}finally{setBusy(false)}}
 async function load(k=key){const d=await call(k);if(d)try{sessionStorage.setItem('calld.admin',k)}catch{}}
 const post=(payload:Record<string,unknown>)=>call(key,{method:'POST',body:JSON.stringify(payload)});
 const pick=(id:string)=>state?.preview.find(p=>p.id===id);
 const fmt=(iso:string)=>new Date(iso).toLocaleString('en-GB',{timeZone:'Europe/Istanbul',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 if(!state)return <main className="c-landing"><div className="c-form"><h2>Match list</h2><label>Admin key<input type="password" value={key} onChange={e=>setKey(e.target.value)} autoComplete="current-password"/></label><button className="c-btn" disabled={busy||!key} onClick={()=>load()}>Open</button>{msg&&<small>{msg}</small>}</div></main>;
 return <main className="c-landing" style={{maxWidth:760}}>
  <h2 style={{font:"700 28px 'Space Grotesk'",margin:0}}>Match list</h2>
  {!state.manual&&<p className="c-hint warn">FOOTBALL_FEED isn’t set to manual in Railway, so groups still use the API feed.</p>}
  <section className="c-form"><h2>1. Add this week’s candidate matches</h2>
   <p className="c-hint">Paste every match worth considering (Thursday to next Wednesday). The rules pick the featured ones. Times are Istanbul time. Re-pasting a line with the same teams and day updates it.</p>
   <textarea className="c-question" style={{minHeight:180,fontSize:14,fontFamily:'ui-monospace,monospace',boxShadow:'none'}} value={text} placeholder={EXAMPLE} onChange={e=>setText(e.target.value)}/>
   <button className="c-btn" disabled={busy||!text.trim()} onClick={async()=>{const d=await post({action:'adminAddMatches',text});if(d){setMsg('Added '+d.added+' matches.');setText('')}}}>Add matches</button>
  </section>
  <section className="c-form"><h2>2. Publish the week</h2><p className="c-hint">Do this once the list is complete, before Thursday 12:00. The next football week opens with the matches the rules pick.</p>
   <button className="c-btn" disabled={busy} onClick={async()=>{const d=await post({action:'adminPublishWeek'});if(d)setMsg('Published. Covers the next 10 days.')}}>Publish week</button></section>
  {msg&&<p className="c-toast" style={{position:'static',whiteSpace:'pre-line'}}>{msg}</p>}
  <section className="c-form"><h2>3. Matches and results</h2><p className="c-hint">Lime = the rules would feature it. Enter the 90-minute score after full time; Postponed gives everyone their points back.</p>
   {!state.matches.length&&<p className="c-hint">No matches yet.</p>}
   {state.matches.map(m=>{const p=pick(m.id),s=scores[m.id]||{h:m.home90?.toString()??'',a:m.away90?.toString()??''};const manual=m.provider==='manual';
    return <div key={m.id} style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',padding:'10px 12px',borderRadius:14,background:p||m.featured?'#EEF8C4':'#F5F3EC'}}>
     <div style={{flex:'1 1 260px',minWidth:0}}><b>{m.home} – {m.away}</b><br/><small>{fmt(m.kickoff)} · {m.league_name}{m.round_name?' · '+m.round_name:''}{p?' · '+p.reason:''}{m.featured?' · in a round':''}</small></div>
     {m.status==='finished'?<b>{m.home90}–{m.away90}</b>:m.status==='void'?<b>Postponed</b>:null}
     {manual&&m.status!=='void'&&<><input aria-label={m.home+' goals'} inputMode="numeric" style={{width:52,minHeight:40,margin:0,padding:'0 8px'}} value={s.h} onChange={e=>setScores({...scores,[m.id]:{...s,h:e.target.value}})}/><input aria-label={m.away+' goals'} inputMode="numeric" style={{width:52,minHeight:40,margin:0,padding:'0 8px'}} value={s.a} onChange={e=>setScores({...scores,[m.id]:{...s,a:e.target.value}})}/>
      <button className="c-chip" disabled={busy||s.h===''||s.a===''} onClick={()=>post({action:'adminResult',id:m.id,home:Number(s.h),away:Number(s.a)})}>Save score</button>
      <button className="c-chip" disabled={busy} onClick={()=>{if(confirm('Mark '+m.home+' – '+m.away+' as postponed? Picks on it won’t count.'))void post({action:'adminVoid',id:m.id})}}>Postponed</button></>}
    </div>})}
  </section>
 </main>;
}
