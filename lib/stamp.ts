// The "called it" stamp, drawn on the server for share cards: the brand's date stamp with the real date in it.
// Letters are real outlines (Space Grotesk), so the card renderer needs no font support for curved text.
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

let font:opentype.Font|null=null;
function load(){return font??=opentype.loadSync(path.join(process.cwd(),'assets/fonts/space-grotesk-latin-700-normal.woff'))}

/** The stamp as SVG: Who’ll on top, CALLED IT below, the date in the middle, inked by hand and tilted. */
export function stampSvg(date:string,year:string,color='#E2462A'){
 const f=load(),em=f.unitsPerEm;
 const adv=(c:string,sz:number)=>f.charToGlyph(c).advanceWidth!*sz/em;
 const ring=(r:number,w:number)=>`<circle cx="300" cy="300" r="${r}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
 // letters placed one by one around the circle, upright, evenly spaced
 const arc=(txt:string,r:number,top:boolean,sz:number,sp:number)=>{
  const gs=[...txt].map(c=>({c,w:adv(c,sz)+sp}));const total=gs.reduce((a,g)=>a+g.w,0)-sp;let a=-total/2;
  return gs.map(g=>{const mid=a+g.w/2-sp/2;a+=g.w;const ang=mid/r*180/Math.PI,rot=top?ang:-ang,rad=(top?ang-90:90-ang)*Math.PI/180;
   const x=300+r*Math.cos(rad),y=300+r*Math.sin(rad),gw=adv(g.c,sz);
   return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(2)}) translate(${(-gw/2).toFixed(1)} ${top?0:(sz*0.72).toFixed(1)})"><path d="${f.charToGlyph(g.c).getPath(0,0,sz).toPathData(2)}" fill="${color}"/></g>`}).join('')};
 const center=(txt:string,y:number,sz:number,sp=0)=>{let w=0;const gs=[...txt].map(c=>{const r={c,x:w};w+=adv(c,sz)+sp;return r});w-=sp;
  return gs.map(({c,x})=>`<path d="${f.charToGlyph(c).getPath(300-w/2+x,y,sz).toPathData(2)}" fill="${color}"/>`).join('')};
 const dot=(ang:number)=>{const rad=(90-ang)*Math.PI/180;return `<circle cx="${(300+236*Math.cos(rad)).toFixed(1)}" cy="${(300+236*Math.sin(rad)).toFixed(1)}" r="9" fill="${color}"/>`};
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
 <defs><filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" result="w"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="11" result="grain"/>
  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5 0 0 0 3.6" result="holes"/>
  <feComposite in="w" in2="holes" operator="in"/></filter></defs>
 <g filter="url(#ink)" transform="rotate(-8 300 300)">
  ${ring(272,16)}${ring(258,4)}${ring(176,5)}
  ${arc('WHO’LL',208,true,52,14)}${arc('CALLED IT',210,false,40,10)}${dot(-62)}${dot(62)}
  <rect x="196" y="244" width="208" height="6" fill="${color}"/><rect x="196" y="380" width="208" height="6" fill="${color}"/>
  ${center(date,330,80,-2)}${center(year,368,24,12)}
 </g></svg>`;
}
/** "06 NOV" and "2026" for a moment, in the group's time zone. */
export function stampDate(at:Date,zone:string){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'short',year:'numeric'}).formatToParts(at).map(x=>[x.type,x.value]));
 return {date:`${p.day} ${String(p.month).slice(0,3).toUpperCase()}`,year:String(p.year)};
}
/** The stamp as a PNG data URI, ready to drop into a card. */
export async function stampDataUri(at:Date,zone:string,color?:string){
 const {date,year}=stampDate(at,zone);
 const png=await sharp(Buffer.from(stampSvg(date,year,color))).resize(320,320).png().toBuffer();
 return 'data:image/png;base64,'+png.toString('base64');
}
