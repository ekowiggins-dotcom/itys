'use client';
import {useEffect,useRef} from 'react';
import {avatarColor,initials} from '../lib/avatar';
// Small shared pieces of the Calld look: faces, icons and bottom sheets.

export function Face({name,size=28,ring='#FFFFFF',me=false}:{name:string;size?:number;ring?:string;me?:boolean}){
 return <span className={'c-face'+(me?' me':'')} title={name} style={{width:size,height:size,background:avatarColor(name),borderColor:ring,fontSize:Math.round(size*0.4)}} aria-hidden="true">{initials(name)}</span>;
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
 arrow:'M5 12h14M13 6l6 6-6 6',share:'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5',
 bell:'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 0 0 3.4 0',crown:'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z',
 star:'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3z',lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
 clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
 info:'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',ball:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7l4 3-1.5 5h-5L8 10z',
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
