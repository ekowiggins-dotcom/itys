import {BRAND} from '../../../lib/brand';
import satori from 'satori';import sharp from 'sharp';import {readFile} from 'node:fs/promises';import path from 'node:path';import {NextRequest} from 'next/server';import {publicShare} from '../../../lib/share-data';import {resolveCode,type ShareTarget} from '../../../lib/short-links';import {avatarColor,initials} from '../../../lib/avatar';
export const runtime='nodejs';
// The 1200×630 picture chat apps show under a shared link.
const fonts=Promise.all(['NotoSans-Regular.ttf','NotoSans-Bold.ttf','NotoSansSymbols2-Regular.ttf','space-grotesk-latin-700-normal.woff','space-grotesk-latin-ext-700-normal.woff'].map(name=>readFile(path.join(process.cwd(),'assets/fonts',name))));
const INK='#17201B',LIME='#D7F25A',SOFT='#C8D0C4';
function Face({name,size,index}:{name:string;size:number;index?:number}){return <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:size,height:size,borderRadius:size,background:avatarColor(name,index),border:'4px solid '+INK,marginRight:-14,color:INK,fontSize:size*0.4,fontWeight:700}}>{initials(name)}</div>}
export async function GET(req:NextRequest){
 try{const p=req.nextUrl.searchParams;const code=p.get('c');
 const target:ShareTarget|null=code?await resolveCode(code):{invite:p.get('invite')||'',questionId:p.get('question')||undefined,roundId:p.get('round')||undefined,winner:p.get('view')==='winner'};
 if(!target)throw Error('Share link not found.');
 const {card}=await publicShare(target.invite,target);const f=await fonts;
 const display='Space Grotesk, Noto Sans, Noto Symbols';
 const titleSize=card.title.length>110?46:card.title.length>70?58:card.title.length>40?70:80;
 const options=(card.options||[]).slice(0,4);
 const body=card.kind==='bet'?<div style={{display:'flex',flexDirection:'column',flexGrow:1}}>
   <div style={{display:'flex',fontFamily:display,fontSize:titleSize,fontWeight:700,lineHeight:1.05,letterSpacing:-2,maxHeight:250,overflow:'hidden'}}>{card.title}</div>
   <div style={{display:'flex',marginTop:34}}>{options.map((o,i)=><div key={o} style={{display:'flex',justifyContent:'center',alignItems:'center',background:i===0?LIME:'#FFFFFF',color:INK,borderRadius:24,padding:'18px 26px',marginRight:16,fontSize:options.length>2?28:34,fontWeight:700,minWidth:options.length>2?150:240}}>{o.length>22?o.slice(0,21)+'…':o}</div>)}</div>
  </div>
  :card.kind==='invite'?<div style={{display:'flex',flexDirection:'column',flexGrow:1}}>
   <div style={{display:'flex',fontSize:30,color:SOFT}}>You’re invited to</div>
   <div style={{display:'flex',fontFamily:display,fontSize:card.title.length>30?68:84,fontWeight:700,lineHeight:1.05,letterSpacing:-2,marginTop:10}}>{card.title}</div>
   <div style={{display:'flex',marginTop:36,alignItems:'center'}}>{(card.members||[]).slice(0,7).map((n,i)=><Face key={n+i} name={n} index={i} size={76}/>)}</div>
  </div>
  :<div style={{display:'flex',flexDirection:'column',flexGrow:1}}>
   <div style={{display:'flex',fontSize:30,color:LIME,fontWeight:700}}>{card.subtitle==='SHARED WEEKLY WIN'?'Shared win of the week':'Winner of the week'}</div>
   <div style={{display:'flex',fontFamily:display,fontSize:card.title.length>30?68:96,fontWeight:700,lineHeight:1.05,letterSpacing:-2,marginTop:12}}>{card.title}</div>
   <div style={{display:'flex',fontSize:36,marginTop:26}}>{card.detail}</div>
  </div>;
 const top=card.kind==='bet'&&card.creator?<div style={{display:'flex',alignItems:'center'}}><Face name={card.creator} size={60}/><div style={{display:'flex',marginLeft:30,fontSize:28,color:SOFT}}><span style={{color:'#FFFFFF',fontWeight:700,marginRight:10}}>{card.creator}’s call</span>· {card.groupName}</div></div>:card.kind==='invite'?<div style={{display:'flex'}}/>:<div style={{display:'flex',fontSize:28,color:SOFT}}>{card.groupName}</div>;
 const svg=await satori(<div style={{display:'flex',width:1200,height:630,background:INK,color:'#FFFFFF',fontFamily:'Noto Sans, Noto Symbols'}}><div style={{display:'flex',flexDirection:'column',position:'absolute',left:64,right:64,top:52,bottom:48}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:34}}>{top}{card.when&&<div style={{display:'flex',background:card.when.startsWith('We’ll')?'#ECE9FF':'#FFE4DC',color:card.when.startsWith('We’ll')?'#4B32B8':'#A1300F',fontSize:24,fontWeight:700,borderRadius:40,padding:'8px 20px'}}>{card.when}</div>}</div>
  {body}
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{display:'flex',fontSize:26,color:SOFT}}>{card.kind==='bet'?(card.picked?card.detail.split(' · ').pop()+'. What’s your call?':'Be the first to call it.'):card.kind==='invite'?card.detail+'. Free, no money.':card.footer}</div><div style={{display:'flex',fontFamily:display,fontSize:44,fontWeight:700,color:LIME}}>{BRAND}</div></div>
 </div></div>,{width:1200,height:630,fonts:[{name:'Space Grotesk',data:f[3],weight:700},{name:'Space Grotesk',data:f[4],weight:700},{name:'Noto Sans',data:f[0],weight:400},{name:'Noto Sans',data:f[1],weight:700},{name:'Noto Symbols',data:f[2],weight:400}]});
 const png=await sharp(Buffer.from(svg)).png().toBuffer();return new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=300'}});
 }catch(e){return new Response((e as Error).message,{status:(e as Error).message.includes('only after')?409:404,headers:{'Cache-Control':'no-store'}})}
}
