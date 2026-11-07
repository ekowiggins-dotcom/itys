'use client';
import {teamColors,teamCode} from '../lib/team-colors';
import {useEffect,useRef} from 'react';
import {avatarColor,initials} from '../lib/avatar';
import {L} from './i18n';
// Small shared pieces of the Who’ll look: faces, icons and bottom sheets.

export function Face({name,size=28,ring='#FFFFFF',me=false}:{name:string;size?:number;ring?:string;me?:boolean}){
 return <span className={'c-face'+(me?' me':'')} title={name} style={{width:size,height:size,background:avatarColor(name),borderColor:ring,fontSize:Math.round(size*(size<34?0.46:0.4))}} aria-hidden="true">{size<34?Array.from(initials(name))[0]:initials(name)}</span>;
}
/** The Who’ll wordmark: light on dark screens, ink on light ones. */
export function Wordmark({on='dark',h=24}:{on?:'dark'|'light';h?:number}){return <img className="c-wordmark" src={on==='dark'?'/brand/wordmark-light.svg':'/brand/wordmark.svg'} alt="Who’ll" style={{height:h,width:'auto',display:'block'}}/>}
/** The called-it stamp: Who’ll on top, CALLED IT below, the day you called it in the middle. Same drawing as the brand stamp. */
export function CalledStamp({at,size=150,color='#E2462A',className=''}:{at:string|number;size?:number;color?:string;className?:string}){
 const d=new Date(at),date=d.toLocaleDateString('en-GB',{day:'2-digit'})+' '+d.toLocaleDateString('en-GB',{month:'short'}).slice(0,3).toUpperCase(),id='st'+Math.round(d.getTime()/1000);
 return <svg className={'c-stamp '+className} viewBox="0 0 600 600" width={size} height={size} role="img" aria-label={'Called it on '+d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}>
  <defs><filter id={id+'f'} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="warp"/><feDisplacementMap in="SourceGraphic" in2="warp" scale="5" result="w"/><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="11" result="grain"/><feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5 0 0 0 3.6" result="holes"/><feComposite in="w" in2="holes" operator="in"/></filter>
   <path id={id+'t'} d="M92,300 A208,208 0 0 1 508,300" fill="none"/><path id={id+'b'} d="M60,300 A240,240 0 0 0 540,300" fill="none"/></defs>
  <g filter={`url(#${id}f)`} transform="rotate(-8 300 300)" fill={color} style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700}}>
   <circle cx="300" cy="300" r="272" fill="none" stroke={color} strokeWidth="16"/><circle cx="300" cy="300" r="258" fill="none" stroke={color} strokeWidth="4"/><circle cx="300" cy="300" r="176" fill="none" stroke={color} strokeWidth="5"/>
   <text fontSize="52" letterSpacing="14"><textPath href={'#'+id+'t'} startOffset="50%" textAnchor="middle">WHO’LL</textPath></text>
   <text fontSize="40" letterSpacing="10" dy="-6"><textPath href={'#'+id+'b'} startOffset="50%" textAnchor="middle">CALLED IT</textPath></text>
   <circle cx="91" cy="411" r="9"/><circle cx="509" cy="411" r="9"/>
   <rect x="196" y="244" width="208" height="6"/><rect x="196" y="380" width="208" height="6"/>
   <text x="300" y="330" fontSize="80" textAnchor="middle" letterSpacing="-2">{date}</text>
   <text x="300" y="368" fontSize="24" textAnchor="middle" letterSpacing="12">{d.getFullYear()}</text>
  </g></svg>;
}
/** Overlapping faces, with "+3" when there are more than fit. */
export function Faces({names,size=26,ring='#FFFFFF',max=6}:{names:string[];size?:number;ring?:string;max?:number}){
 const shown=names.slice(0,max),rest=names.length-shown.length;
 return <span className="c-faces" aria-label={names.join(', ')}>{shown.map((n,i)=><Face key={n+i} name={n} size={size} ring={ring}/>)}{rest>0&&<span className="c-face more" style={{width:size,height:size,borderColor:ring,fontSize:Math.round(size*0.36)}}>+{rest}</span>}</span>;
}

const PATHS:Record<string,string>={
 calls:'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
 ranking:'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3',
 group:'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
 plus:'M12 5v14M5 12h14',close:'M6 6l12 12M18 6L6 18',check:'M5 12.5l4.5 4.5L19 7.5',back:'M15 5l-7 7 7 7',
 arrow:'M5 12h14M13 6l6 6-6 6',down:'M6 9l6 6 6-6',share:'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5',
 bell:'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 0 0 3.4 0',crown:'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z',
 star:'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3z',lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
 clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
 info:'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',eyeoff:'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2.5 12s3.5 6 9.5 6a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',ball:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7l4 3-1.5 5h-5L8 10z',
};
export function Icon({name,size=20,stroke=2,className}:{name:keyof typeof PATHS|string;size?:number;stroke?:number;className?:string}){
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]||''}/></svg>;
}

/** A bottom sheet over the app. Closes on the backdrop, the close button or Escape. */
export function Sheet({open,onClose,label,dark=false,children,full=false}:{open:boolean;onClose:()=>void;label:string;dark?:boolean;full?:boolean;children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const prev=document.activeElement as HTMLElement|null;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',onKey);document.body.classList.add('c-locked');setTimeout(()=>ref.current?.querySelector<HTMLElement>('[data-autofocus],button,input,textarea')?.focus(),30);return ()=>{document.removeEventListener('keydown',onKey);document.body.classList.remove('c-locked');prev?.focus?.()}},[open]);
 if(!open)return null;
 return <div className="c-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div ref={ref} className={'c-sheet'+(dark?' dark':'')+(full?' full':'')} role="dialog" aria-modal="true" aria-label={label}><span className="c-grip" aria-hidden="true"/><button className="c-close" aria-label="Close" onClick={onClose}><Icon name="close" size={18} stroke={2.5}/></button>{children}</div></div>;
}

export function Badge({tone,children}:{tone:'soon'|'later'|'locked'|'done'|'neutral';children:React.ReactNode}){return <span className={'c-badge '+tone}>{children}</span>}

/** Answers, not people: the split uses ink shades (your answer in lime), never face colours, so nobody reads a dot as a friend. */
const SPLIT_COLORS=['#17201B','#6B746C','#A3ABA4','#CDD2CA'];const splitColor=(a:string,i:number,mine?:string|null)=>a===mine?'#D7F25A':SPLIT_COLORS[i%4];
/** How the group is split, without names: a stacked bar, then one row of dots per answer. */
/** The live tally on a call card: the leading answers with their share, yours in lime, and how many have picked. */
export function Tally({answers,counts,mine,label,picked,of}:{answers:string[];counts:Record<string,number>;mine?:string|null;label:(a:string)=>string;picked:number;of:number}){
 const total=answers.reduce((n,a)=>n+(counts[a]||0),0);if(!total)return null;
 const ranked=answers.filter(a=>counts[a]).sort((x,y)=>(counts[y]||0)-(counts[x]||0)||(x===mine?-1:y===mine?1:0));
 const shown=ranked.slice(0,3);if(mine&&counts[mine]&&!shown.includes(mine))shown[2]=mine;
 const more=ranked.length-shown.length,pct=(a:string)=>Math.round(100*(counts[a]||0)/total);
 return <div className="c-tally" aria-label={shown.map(a=>label(a)+' '+pct(a)+'%').join(', ')}>
  {shown.map(a=><div key={a} className={'c-tally-row'+(a===mine?' mine':'')}><span className="c-tally-label"><span>{label(a)}</span>{a===mine&&<em>{L('you','sen')}</em>}</span><span className="c-tally-track"><i style={{width:pct(a)+'%'}}/></span><b>{pct(a)}%</b></div>)}
  <span className="c-tally-foot">{more>0?L(`+${more} more · `,`+${more} seçenek daha · `):''}{picked>=of&&of>1?L('Everyone’s in','Herkes seçti'):L(`${picked} of ${of} picked`,`${of} kişiden ${picked} seçti`)}</span>
 </div>;
}
export function Split({answers,counts,mine,label,compact=false}:{answers:string[];counts:Record<string,number>;mine?:string|null;label:(a:string)=>string;compact?:boolean}){
 const total=answers.reduce((n,a)=>n+(counts[a]||0),0);if(!total)return null;
 return <div className={'c-split'+(compact?' compact':'')} aria-label={answers.map(a=>(counts[a]||0)+' said '+label(a)).join(', ')}>
  <div className="c-split-bar" aria-hidden="true">{answers.map((a,i)=>counts[a]?<i key={a} style={{flexGrow:counts[a],background:splitColor(a,i,mine)}}/>:null)}</div>
  {!compact&&answers.map((a,i)=><div key={a} className={'c-split-row'+(a===mine?' mine':'')} aria-hidden="true"><span className="c-split-label"><span>{label(a)}</span>{a===mine&&<em>{L('you','sen')}</em>}</span><span className="c-split-track"><i style={{width:(total?Math.round(100*(counts[a]||0)/total):0)+'%',background:splitColor(a,i,mine)}}/></span><b>{Math.round(100*(counts[a]||0)/total)}%<small>{counts[a]||0}</small></b></div>)}
  {compact&&<span className="c-split-legend" aria-hidden="true">{answers.filter(a=>counts[a]).map(a=>counts[a]+' said '+label(a)).join(' · ')}</span>}
 </div>;
}

/** A club as a coloured disc with its three-letter code. No badges or logos. */
export function Crest({team,size=52}:{team:string;size?:number}){const c=teamColors(team);
 return <span className="c-crest" aria-hidden="true" style={{width:size,height:size,background:c.fill,color:c.text,boxShadow:`inset 0 0 0 ${Math.max(3,size/14)}px ${c.ring}`,fontSize:size*0.3}}>{teamCode(team)}</span>;
}

/** Apple's own button style: black, the Apple mark, "Sign in with Apple". */
export function AppleButton({onClick,busy,children='Sign in with Apple'}:{onClick:()=>void;busy?:boolean;children?:React.ReactNode}){
 return <button type="button" className="c-apple" disabled={busy} onClick={onClick}><svg viewBox="0 0 17 20" width="17" height="20" aria-hidden="true"><path fill="currentColor" d="M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.7 4.8 2 5.8 1.1 7.4c-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 1.9 2.7 3.3 2.7 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1-2.9-4.6zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg><span>{children}</span></button>;
}
