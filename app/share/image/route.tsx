import {BRAND} from '../../../lib/brand';
import satori from 'satori';import sharp from 'sharp';import {readFile} from 'node:fs/promises';import path from 'node:path';import {NextRequest} from 'next/server';import {publicShare} from '../../../lib/share-data';import {resolveCode,type ShareTarget} from '../../../lib/short-links';import {avatarColor,initials} from '../../../lib/avatar';import {teamColors,teamCode} from '../../../lib/team-colors';
import type {ShareCard} from '../../../lib/sharing';
export const runtime='nodejs';
// The 1200×630 picture chat apps show under a shared link. Everything sits inside a 1200×630 frame with no
// important text in the outer 40px, because some apps crop the edges.
const fonts=Promise.all(['NotoSans-Regular.ttf','NotoSans-Bold.ttf','NotoSansSymbols2-Regular.ttf','space-grotesk-latin-700-normal.woff','space-grotesk-latin-ext-700-normal.woff'].map(name=>readFile(path.join(process.cwd(),'assets/fonts',name))));
const INK='#17201B',LIME='#D7F25A',SOFT='#C8D0C4',LINE='#26342C';
const DISPLAY='Space Grotesk, Noto Sans, Noto Symbols';
const flex=(s:Record<string,unknown>={})=>({display:'flex',...s});
const closed=(card:ShareCard)=>card.when==='Picks are closed'||card.when==='Kicked off';

function Face({name,size,index}:{name:string;size:number;index?:number}){return <div style={flex({alignItems:'center',justifyContent:'center',width:size,height:size,borderRadius:size,background:avatarColor(name,index),border:'4px solid '+INK,marginRight:-14,color:INK,fontSize:size*0.4,fontWeight:700})}>{initials(name)}</div>}
function Chip({children,tone='soon'}:{children:React.ReactNode;tone?:'soon'|'later'|'lime'}){const c=tone==='lime'?[LIME,INK]:tone==='later'?['#ECE9FF','#4B32B8']:['#FFE4DC','#A1300F'];return <div style={flex({background:c[0],color:c[1],fontSize:26,fontWeight:700,borderRadius:40,padding:'10px 22px'})}>{children}</div>}
/** "3 friends have called it" with anonymous dots (no names in previews). */
function Crowd({n}:{n:number}){return <div style={flex({alignItems:'center'})}>
 {n>0&&<div style={flex({marginRight:16})}>{Array.from({length:Math.min(n,6)}).map((_,i)=><div key={i} style={flex({width:30,height:30,borderRadius:30,background:['#FF8A5B','#6FB7FF','#A98BFF','#4FD39A','#FFC145','#FF7EB6'][i],border:'4px solid '+INK,marginRight:-10})}/>)}</div>}
 <div style={flex({fontSize:28,color:SOFT})}>{n>0?`${n} ${n===1?'friend has':'friends have'} called it. Your turn.`:'Be the first to call it.'}</div></div>}
function Cta({children}:{children:React.ReactNode}){return <div style={flex({alignItems:'center',background:LIME,color:INK,borderRadius:40,padding:'14px 28px',fontSize:30,fontWeight:700,fontFamily:DISPLAY})}>{children}<svg width="30" height="30" viewBox="0 0 24 24" style={{marginLeft:12}}><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#17201B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
function Crest({team,size=170}:{team:string;size?:number}){const c=teamColors(team);return <div style={flex({width:size,height:size,borderRadius:size,background:c.fill,border:'10px solid '+c.ring,alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 6px '+INK})}><div style={flex({fontFamily:DISPLAY,fontSize:size*0.3,fontWeight:700,color:c.text,letterSpacing:2})}>{teamCode(team)}</div></div>}

/** A match: two club discs, VS, the kickoff, and who's in. */
function Match({card}:{card:ShareCard}){const [home,away]=card.teams!;const nameSize=Math.max(home.length,away.length)>14?38:46;
 return <div style={flex({position:'relative',width:1200,height:630,background:INK,color:'#FFFFFF',fontFamily:'Noto Sans, Noto Symbols'})}>
  {/* faint pitch */}
  <div style={flex({position:'absolute',left:599,top:0,width:2,height:630,background:LINE})}/>
  <div style={flex({position:'absolute',left:450,top:165,width:300,height:300,borderRadius:300,border:'2px solid '+LINE})}/>
  <div style={flex({position:'absolute',left:40,top:150,width:120,height:330,border:'2px solid '+LINE,borderLeft:'none'})}/>
  <div style={flex({position:'absolute',right:40,top:150,width:120,height:330,border:'2px solid '+LINE,borderRight:'none'})}/>
  <div style={flex({position:'absolute',left:56,right:56,top:44,bottom:44,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}>
    <div style={flex({fontSize:26,color:LIME,fontWeight:700})}>{card.subtitle} · {card.groupName}</div>
    {card.when&&<Chip>{card.when}</Chip>}
   </div>
   <div style={flex({flexGrow:1,alignItems:'center',justifyContent:'space-between',padding:'0 40px'})}>
    <div style={flex({flexDirection:'column',alignItems:'center',width:330})}><Crest team={home}/><div style={flex({marginTop:22,fontFamily:DISPLAY,fontSize:nameSize,fontWeight:700,textAlign:'center'})}>{home}</div></div>
    <div style={flex({flexDirection:'column',alignItems:'center'})}><div style={flex({fontFamily:DISPLAY,fontSize:64,fontWeight:700,color:LIME})}>VS</div><div style={flex({fontSize:24,color:SOFT,marginTop:6})}>Who wins?</div></div>
    <div style={flex({flexDirection:'column',alignItems:'center',width:330})}><Crest team={away}/><div style={flex({marginTop:22,fontFamily:DISPLAY,fontSize:nameSize,fontWeight:700,textAlign:'center'})}>{away}</div></div>
   </div>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><Crowd n={card.picked||0}/><div style={flex({alignItems:'center'})}><Cta>{closed(card)?'See who said what':'Make your call'}</Cta><div style={flex({marginLeft:24,fontFamily:DISPLAY,fontSize:40,fontWeight:700,color:LIME})}>{BRAND}</div></div></div>
  </div>
 </div>}

/** A friends' call: the question, its answers as big buttons, who made it. */
function Call({card}:{card:ShareCard}){const options=(card.options||[]).slice(0,4),secret=!options.length;const titleSize=card.title.length>110?46:card.title.length>70?56:card.title.length>40?68:78;
 return <div style={flex({position:'relative',width:1200,height:630,background:INK,color:'#FFFFFF',fontFamily:'Noto Sans, Noto Symbols'})}>
  <div style={flex({position:'absolute',right:-140,top:-160,width:460,height:460,borderRadius:460,background:LIME,opacity:0.1})}/>
  <div style={flex({position:'absolute',left:-120,bottom:-200,width:380,height:380,borderRadius:380,background:'#A98BFF',opacity:0.12})}/>
  <div style={flex({position:'absolute',left:56,right:56,top:44,bottom:44,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}>
    {card.creator?<div style={flex({alignItems:'center'})}><Face name={card.creator} size={58}/><div style={flex({marginLeft:30,fontSize:28,color:SOFT})}><span style={{color:'#FFFFFF',fontWeight:700,marginRight:10}}>{card.creator}’s call</span>· {card.groupName}</div></div>:<div style={flex({fontSize:28,color:SOFT})}>{card.groupName}</div>}
    {card.when&&<Chip tone={card.when.startsWith('We’ll')?'later':'soon'}>{card.when}</Chip>}
   </div>
   <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}>
    <div style={flex({fontFamily:DISPLAY,fontSize:secret?84:titleSize,fontWeight:700,lineHeight:1.05,letterSpacing:-2,maxHeight:250,overflow:'hidden'})}>{secret?'A secret call about a friend':card.title}</div>
    {secret?<div style={flex({fontSize:32,color:SOFT,marginTop:20})}>Everyone in the group can see it. Except them.</div>:
    <div style={flex({marginTop:30})}>{options.map(o=><div key={o} style={flex({justifyContent:'center',alignItems:'center',border:'3px solid #FFFFFF',color:'#FFFFFF',borderRadius:22,padding:'16px 26px',marginRight:16,fontSize:options.length>2?28:34,fontWeight:700,minWidth:options.length>2?150:230})}>{o.length>22?o.slice(0,21)+'…':o}</div>)}</div>}
   </div>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><Crowd n={card.picked||0}/><div style={flex({alignItems:'center'})}><Cta>{secret?'Take a look':closed(card)?'See who said what':'Make your call'}</Cta><div style={flex({marginLeft:24,fontFamily:DISPLAY,fontSize:40,fontWeight:700,color:LIME})}>{BRAND}</div></div></div>
  </div>
 </div>}

function Invite({card}:{card:ShareCard}){return <div style={flex({position:'relative',width:1200,height:630,background:INK,color:'#FFFFFF',fontFamily:'Noto Sans, Noto Symbols'})}>
 <div style={flex({position:'absolute',right:-140,top:-160,width:460,height:460,borderRadius:460,background:LIME,opacity:0.1})}/>
 <div style={flex({position:'absolute',left:56,right:56,top:44,bottom:44,flexDirection:'column'})}>
  <div style={flex({justifyContent:'space-between',alignItems:'center'})}><div style={flex({fontSize:28,color:SOFT})}>You’re invited</div><Chip tone="lime">Free · no money</Chip></div>
  <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}>
   <div style={flex({fontFamily:DISPLAY,fontSize:card.title.length>30?72:92,fontWeight:700,lineHeight:1.04,letterSpacing:-2})}>{card.title}</div>
   <div style={flex({marginTop:30,alignItems:'center'})}>{(card.members||[]).slice(0,7).map((n,i)=><Face key={n+i} name={n} index={i} size={78}/>)}<div style={flex({marginLeft:40,fontSize:30,color:SOFT})}>{card.detail}</div></div>
  </div>
  <div style={flex({justifyContent:'space-between',alignItems:'center'})}><div style={flex({fontSize:28,color:SOFT})}>Make calls. See who said what. Brag.</div><div style={flex({alignItems:'center'})}><Cta>Join</Cta><div style={flex({marginLeft:24,fontFamily:DISPLAY,fontSize:40,fontWeight:700,color:LIME})}>{BRAND}</div></div></div>
 </div>
</div>}

function Winner({card}:{card:ShareCard}){return <div style={flex({position:'relative',width:1200,height:630,background:LIME,color:INK,fontFamily:'Noto Sans, Noto Symbols'})}>
 <div style={flex({position:'absolute',left:56,right:56,top:44,bottom:44,flexDirection:'column'})}>
  <div style={flex({fontSize:30,fontWeight:700})}>{card.subtitle==='SHARED WEEKLY WIN'?'Shared win of the week':'Winner of the week'} · {card.groupName}</div>
  <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}><div style={flex({fontFamily:DISPLAY,fontSize:card.title.length>30?72:110,fontWeight:700,lineHeight:1,letterSpacing:-3})}>{card.title}</div><div style={flex({fontSize:40,marginTop:24,fontWeight:700})}>{card.detail}</div></div>
  <div style={flex({justifyContent:'space-between',alignItems:'center'})}><div style={flex({fontSize:28})}>{card.footer}</div><div style={flex({fontFamily:DISPLAY,fontSize:44,fontWeight:700})}>{BRAND}</div></div>
 </div>
</div>}

export async function GET(req:NextRequest){
 try{const p=req.nextUrl.searchParams;const code=p.get('c');
 const target:ShareTarget|null=code?await resolveCode(code):{invite:p.get('invite')||'',questionId:p.get('question')||undefined,roundId:p.get('round')||undefined,winner:p.get('view')==='winner'};
 if(!target)throw Error('Share link not found.');
 const {card}=await publicShare(target.invite,target);const f=await fonts;
 const body=card.kind==='bet'?(card.teams?<Match card={card}/>:<Call card={card}/>):card.kind==='invite'?<Invite card={card}/>:<Winner card={card}/>;
 const svg=await satori(body,{width:1200,height:630,fonts:[{name:'Space Grotesk',data:f[3],weight:700},{name:'Space Grotesk',data:f[4],weight:700},{name:'Noto Sans',data:f[0],weight:400},{name:'Noto Sans',data:f[1],weight:700},{name:'Noto Symbols',data:f[2],weight:400}]});
 const png=await sharp(Buffer.from(svg)).png().toBuffer();return new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=300'}});
 }catch(e){return new Response((e as Error).message,{status:(e as Error).message.includes('only after')?409:404,headers:{'Cache-Control':'no-store'}})}
}
