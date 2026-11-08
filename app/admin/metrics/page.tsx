'use client';
// Operator page: is the MVP working? Needs ADMIN_KEY. Not linked from the app. Aggregate numbers only.
import {useEffect,useState} from 'react';
type Week={week:string;newGroups:number;activeGroups:number;calls:number;picks:number;pickRate:number|null;settled:number;callsPerActiveGroup:number|null};
type Cohort={week:string;groups:number;active:(number|null)[]};
type Group={name:string;members:number;started:string;calls7:number;picks7:number;callers7:number;lastActive:string|null;unsettled:number};
type M={generatedAt:string;totals:{groups:number;players:number;activeThisWeek:number;unsettled:number};weeks:Week[];cohorts:Cohort[];groups:Group[]};
const day=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const ago=(iso:string|null)=>{if(!iso)return '–';const h=Math.round((Date.now()-Date.parse(iso))/3600000);return h<1?'now':h<48?h+'h ago':Math.round(h/24)+'d ago'};
const cell=(v:number|null,unit='')=>v===null?<td className="mx-dim">–</td>:<td>{v}{unit}</td>;
const heat=(v:number|null)=>v===null?{}:{background:`rgba(215,242,90,${Math.min(1,v/100)})`};

export default function Metrics(){
 const [key,setKey]=useState(''),[m,setM]=useState<M|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 async function load(k=key){setBusy(true);setErr('');try{const r=await fetch('/api/admin?metrics',{headers:{'x-admin-key':k}});const d=await r.json();if(!r.ok)throw Error(d.error);setM(d);try{sessionStorage.setItem('calld.admin',k)}catch{}}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 useEffect(()=>{try{const k=sessionStorage.getItem('calld.admin');if(k){setKey(k);void load(k)}}catch{}},[]);// eslint-disable-line react-hooks/exhaustive-deps
 if(!m)return <main className="c-landing"><form className="c-form" onSubmit={e=>{e.preventDefault();void load()}}><h2>Metrics</h2><label>Admin key<input type="password" value={key} onChange={e=>setKey(e.target.value)} autoComplete="current-password"/></label><button className="c-btn" disabled={busy||!key}>Open</button>{err&&<p className="c-hint warn">{err}</p>}</form></main>;
 const t=m.totals;
 return <main className="mx">
  <header><h1>Is it working?</h1><button className="c-chip" onClick={()=>void load()} disabled={busy}>{busy?'Loading…':'Refresh'}</button></header>
  <section className="mx-tiles">
   <div><b>{t.activeThisWeek}</b><span>groups active in the last 7 days</span><small>of {t.groups} groups</small></div>
   <div><b>{t.players}</b><span>players</span></div>
   <div className={t.unsettled?'warn':''}><b>{t.unsettled}</b><span>calls nobody has settled</span><small>a day past their time</small></div>
  </section>
  <section><h2>Do groups come back?</h2><p className="mx-note">Groups by the week they started, and the share still making calls or picks 1–4 weeks later. Week 4 is the number that matters: aim for 50%.</p>
   <table><thead><tr><th>Started</th><th>Groups</th><th>Wk 1</th><th>Wk 2</th><th>Wk 3</th><th>Wk 4</th></tr></thead>
   <tbody>{m.cohorts.filter(c=>c.groups).map(c=><tr key={c.week}><td>{day(c.week)}</td><td>{c.groups}</td>{c.active.map((v,i)=>v===null?<td key={i} className="mx-dim">–</td>:<td key={i} style={heat(v)}>{v}%</td>)}</tr>)}</tbody></table>
   {!m.cohorts.some(c=>c.groups)&&<p className="mx-note">No groups yet.</p>}</section>
  <section><h2>Week by week</h2><p className="mx-note">Pick rate: of everyone who could pick a call that closed that week, how many did. Calls per group: aim for 3+.</p>
   <table><thead><tr><th>Week of</th><th>New groups</th><th>Active groups</th><th>Calls</th><th>Calls / group</th><th>Picks</th><th>Pick rate</th><th>Settled</th></tr></thead>
   <tbody>{[...m.weeks].reverse().map(w=><tr key={w.week}><td>{day(w.week)}</td><td>{w.newGroups}</td><td>{w.activeGroups}</td><td>{w.calls}</td>{cell(w.callsPerActiveGroup)}<td>{w.picks}</td>{cell(w.pickRate,'%')}<td>{w.settled}</td></tr>)}</tbody></table></section>
  <section><h2>Groups</h2><p className="mx-note">Last 7 days. “Callers” is how many different people made a call: if it’s always 1, only the admin is playing.</p>
   <table><thead><tr><th>Group</th><th>Members</th><th>Started</th><th>Calls</th><th>Callers</th><th>Picks</th><th>Unsettled</th><th>Last seen</th></tr></thead>
   <tbody>{m.groups.map((g,i)=><tr key={i}><td>{g.name}</td><td>{g.members}</td><td>{day(g.started)}</td><td>{g.calls7}</td><td>{g.callers7}</td><td>{g.picks7}</td><td className={g.unsettled?'warn':''}>{g.unsettled}</td><td>{ago(g.lastActive)}</td></tr>)}</tbody></table></section>
  <p className="mx-note">Updated {new Date(m.generatedAt).toLocaleString('en-GB',{timeZone:'Europe/Istanbul'})}. Practice groups left out.</p>
 </main>;
}
