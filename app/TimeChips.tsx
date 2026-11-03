'use client';
import {useMemo,useState} from 'react';
import {when} from './format';

type Preset={label:string;at:number};
const H=3600000,D=24*H;

function at(base:number,days:number,hour:number,minute=0){const d=new Date(base);d.setDate(d.getDate()+days);d.setHours(hour,minute,0,0);return d.getTime()}
function nextWeekday(now:number,weekday:number,hour:number,minute=0){const d=new Date(now);const add=(weekday-d.getDay()+7)%7;let t=at(now,add,hour,minute);if(t<=now)t=at(now,add+7,hour,minute);return t}
const localInput=(ms:number)=>{const d=new Date(ms),p=(n:number)=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};

/** Presets for a weekly bet's lock time, all before the round deadline. */
export function weeklyPresets(now:number,deadline:number):Preset[]{
 const list:Preset[]=[{label:'Tonight 21:00',at:at(now,0,21)},{label:'Tomorrow 12:00',at:at(now,1,12)},{label:'Fri 18:00',at:nextWeekday(now,5,18)},{label:'Sat 12:00',at:nextWeekday(now,6,12)},{label:'Sat 20:00',at:nextWeekday(now,6,20)},{label:'Sun 12:00',at:nextWeekday(now,0,12)}];
 const ok=list.filter(p=>p.at>now+15*60000&&p.at<=deadline);
 if(deadline>now+15*60000)ok.push({label:'Last call · '+when(deadline,now),at:deadline});
 const seen=new Set<number>();return ok.filter(p=>!seen.has(p.at)&&seen.add(p.at)).slice(0,5);
}
export function lockPresets(now:number):Preset[]{return[{label:'Tomorrow',at:at(now,1,12)},{label:'In 3 days',at:at(now,3,12)},{label:'In a week',at:at(now,7,12)}]}
export function resolvePresets(now:number):Preset[]{const end=new Date(now);end.setMonth(11,31);end.setHours(23,59,0,0);const list=[{label:'In a month',at:at(now,30,23,59)},{label:'In 3 months',at:at(now,91,23,59)},{label:'In 6 months',at:at(now,182,23,59)}];if(end.getTime()>at(now,30,0))list.push({label:'End of year',at:end.getTime()});return list}

/** Tap-to-choose time with a "Custom" fallback. Submits an ISO string under `name`. */
export default function TimeChips({name,presets,now,max,label}:{name:string;presets:Preset[];now:number;max?:number;label:string}){
 const [value,setValue]=useState<number|null>(presets[0]?.at??null),[custom,setCustom]=useState(!presets.length);
 const [raw,setRaw]=useState('');
 const iso=useMemo(()=>custom?(raw?new Date(raw).toISOString():''):value?new Date(value).toISOString():'',[custom,raw,value]);
 return <div className="time-chips"><span className="field-label">{label}</span><div className="chips">{presets.map(p=><button type="button" key={p.label} className={!custom&&value===p.at?'on':''} onClick={()=>{setCustom(false);setValue(p.at)}}>{p.label}</button>)}<button type="button" className={custom?'on':''} onClick={()=>setCustom(true)}>Custom</button></div>
  {custom&&<input type="datetime-local" aria-label={label} required value={raw} min={localInput(now)} max={max?localInput(max):undefined} onChange={e=>setRaw(e.target.value)}/>}
  <input type="hidden" name={name} value={iso}/></div>;
}
