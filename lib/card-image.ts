import {BRAND} from './brand';
import type {ShareCard} from './sharing';
export async function cardPng(card:ShareCard){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export is unavailable in this browser.');
 ctx.fillStyle=card.kind==='winner'?'#d9f35b':'#f4f3ed';ctx.fillRect(0,0,1200,630);ctx.fillStyle='#242b25';ctx.textBaseline='top';ctx.font='700 38px sans-serif';ctx.fillText(BRAND+' ↗',60,48);ctx.font='600 17px sans-serif';ctx.textAlign='right';ctx.fillText(card.kind==='winner'?'WEEKLY RESULTS · FINAL':'FREE POINTS. REAL BRAGGING RIGHTS.',1140,62);ctx.textAlign='left';ctx.fillStyle='#657050';ctx.font='600 21px sans-serif';ctx.fillText(card.groupName.slice(0,60),60,130);ctx.font='700 17px sans-serif';ctx.fillText(card.subtitle,60,172);
 const wrap=(text:string,width:number)=>{const lines:string[]=[];let line='';for(const word of text.split(/\s+/)){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width<=width){line=candidate;continue}if(line){lines.push(line);line=''}for(const char of Array.from(word)){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line=char}else line+=char;}}if(line)lines.push(line);return lines};
 let size=66,lines:string[]=[];do{ctx.font=`700 ${size}px sans-serif`;lines=wrap(card.title,1080);if(lines.length*size*1.13<=240)break;size-=2;}while(size>28);
 ctx.fillStyle='#242b25';lines.forEach((line,i)=>ctx.fillText(line,60,212+i*size*1.13));ctx.font='600 32px sans-serif';ctx.fillText(card.detail,60,486);ctx.fillStyle='#657050';ctx.font='400 19px sans-serif';ctx.fillText(card.footer,60,568);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Unable to export the card.')),'image/png'));
 return new File([blob],card.kind==='winner'?BRAND+'-weekly-winner.png':BRAND+'-prediction.png',{type:'image/png'});
}
