// The pictures WhatsApp shows under a shared link (1200×630, nothing important in the outer 44px).
// One job each: a question, faces, curiosity. Readable as a thumbnail. Each group has its own colour.
import {BRAND} from './brand';
import {AVATAR_COLORS,initials} from './avatar';

export type Lang='tr'|'en';
export type Art=
 |{variant:'friend';lang:Lang;group:GroupLook;question:string;answers:string[];pickers:string[];when?:string}
 |{variant:'choice';lang:Lang;group:GroupLook;question:string;answers:string[];pickers:string[];when?:string}
 |{variant:'picked';lang:Lang;group:GroupLook;subject:string;count:number;question:string}
 |{variant:'result';lang:Lang;group:GroupLook;question:string;answer:string;winners:string[];right:number;total:number}
 |{variant:'invite';lang:Lang;group:GroupLook;members:string[]}
 |{variant:'moment';lang:Lang;group:GroupLook;title:string;kind:string;when:string;questions:string[];pickers:string[]}
 |{variant:'momentResult';lang:Lang;group:GroupLook;title:string;kind:string;winners:string[];right:number;of:number};
export type GroupLook={name:string;color:string};

/** Group colours: bright, with ink text on top. */
export const GROUP_COLORS={coral:'#FF8A5B',sky:'#7CC0FF',violet:'#B9A2FF',mint:'#5FDDA6',sun:'#FFC94D',pink:'#FF8EC2',lime:'#D7F25A'} as const;
const INK='#17201B',WHITE='#FFFFFF';
const DISPLAY='Space Grotesk, Noto Sans';
const flex=(s:Record<string,unknown>={})=>({display:'flex',...s});

const T={
 en:{calls:(n:number)=>`${n} ${n===1?'call':'calls'}`,more:(n:number)=>`+${n} more`,makeCalls:'Make your calls',oracleOf:(t:string)=>`Oracle of ${t}`,knew:(r:number,o:number)=>`${r} of ${o} right`,kinds:{birthday:'Birthday',trip:'Trip',wedding:'Wedding',night:'Night out',baby:'Baby',job:'New start',own:'Moment'} as Record<string,string>,answer:'Answer',pick:'Pick one',see:'See who',open:'Take a look',join:'Join',picked:(n:number)=>`${n} ${n===1?'friend':'friends'} picked`,you:'you',forSomething:'for something.',calledIt:'Called it.',sawIt:(r:number,t:number)=>`${r} of ${t} saw it coming`,invited:'You’re invited',waiting:(n:number)=>`${n} ${n===1?'friend is':'friends are'} making calls`,inAlready:(names:string[],more:number)=>`${names.join(', ')}${more?' +'+more:''} ${names.length+more===1?'has':'have'} picked`,beFirst:'Be the first to pick',free:'Free · no money'},
 tr:{calls:(n:number)=>`${n} soru`,more:(n:number)=>`+${n} soru daha`,makeCalls:'Tahminini yap',oracleOf:(t:string)=>`${t} kâhini`,knew:(r:number,o:number)=>`${o} sorudan ${r} doğru`,kinds:{birthday:'Doğum günü',trip:'Tatil',wedding:'Düğün',night:'Gece',baby:'Bebek',job:'Yeni başlangıç',own:'An'} as Record<string,string>,answer:'Cevap',pick:'Seç',see:'Kim ne dedi?',open:'Bak',join:'Katıl',picked:(n:number)=>`${n} arkadaşın`,you:'seni',forSomething:'seçti.',calledIt:'Bildi.',sawIt:(r:number,t:number)=>`${t} kişiden ${r} kişi bildi`,invited:'Davetlisin',waiting:(n:number)=>`${n} arkadaşın tahmin yapıyor`,inAlready:(names:string[],more:number)=>`${names.join(', ')}${more?' +'+more:''} seçti`,beFirst:'İlk seçen sen ol',free:'Ücretsiz · para yok'},
};

/** Face colours never match the card behind them. */
let bg='';const palette=()=>AVATAR_COLORS.filter(c=>c.toLowerCase()!==bg.toLowerCase()&&!(bg===GROUP_COLORS.coral&&c==='#F59E8C'));
function Face({name,size,ring=INK,i}:{name:string;size:number;ring?:string;i:number}){const p=palette();
 return <div style={flex({width:size,height:size,borderRadius:size,background:p[i%p.length],border:`${Math.round(size/14)}px solid ${ring}`,alignItems:'center',justifyContent:'center',fontFamily:DISPLAY,fontSize:Math.round(size*0.4),fontWeight:700,color:INK})}>{initials(name)}</div>;
}
function Brand({group,dark=false}:{group:GroupLook;dark?:boolean}){
 return <div style={flex({alignItems:'center'})}>
  <div style={flex({background:dark?group.color:INK,color:dark?INK:group.color,borderRadius:40,padding:'8px 22px',fontFamily:DISPLAY,fontSize:30,fontWeight:700,letterSpacing:-1})}>{BRAND}</div>
  <div style={flex({marginLeft:18,fontSize:30,fontWeight:700,color:dark?WHITE:INK})}>{group.name}</div>
 </div>;
}
function Chip({children,dark=false}:{children:React.ReactNode;dark?:boolean}){return <div style={flex({background:dark?'rgba(255,255,255,0.12)':'rgba(23,32,27,0.12)',color:dark?WHITE:INK,borderRadius:40,padding:'10px 22px',fontSize:26,fontWeight:700})}>{children}</div>}
function Cta({children,color=INK,text=WHITE}:{children:React.ReactNode;color?:string;text?:string}){
 return <div style={flex({alignItems:'center',background:color,color:text,borderRadius:48,padding:'18px 34px',fontFamily:DISPLAY,fontSize:34,fontWeight:700})}>{children}<svg width="34" height="34" viewBox="0 0 24 24" style={{marginLeft:12}}><path d="M5 12h13M13 6l6 6-6 6" stroke={text} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>;
}
const qSize=(q:string)=>q.length>95?50:q.length>70?58:q.length>45?68:80;
function Proof({pickers,lang}:{pickers:string[];lang:Lang}){const t=T[lang];const shown=pickers.slice(0,2),more=pickers.length-shown.length;
 return <div style={flex({alignItems:'center',marginTop:22})}>
  {pickers.length>0&&<div style={flex({marginRight:16})}>{pickers.slice(0,4).map((n,i)=><div key={n+i} style={flex({marginLeft:i?-14:0})}><Face name={n} size={46} i={i+3}/></div>)}</div>}
  <div style={flex({fontSize:28,fontWeight:700,color:'rgba(23,32,27,0.72)'})}>{pickers.length?t.inAlready(shown,more):t.beFirst}</div>
 </div>;
}
const frame=(bg:string,children:React.ReactNode,color=INK)=><div style={flex({position:'relative',width:1200,height:630,background:bg,color,fontFamily:'Noto Sans',overflow:'hidden'})}>{children}</div>;
const blob=(s:Record<string,unknown>)=><div style={flex({position:'absolute',borderRadius:999,...s})}/>;

/** Pick a friend: the question, then the friends as the answers. */
function Friend({a}:{a:Extract<Art,{variant:'friend'}>}){const t=T[a.lang];const shown=a.answers.slice(0,5),more=a.answers.length-shown.length;
 return frame(a.group.color,<>
  {blob({right:-120,top:-140,width:420,height:420,background:'rgba(255,255,255,0.22)'})}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><Brand group={a.group}/>{a.when&&<Chip>{a.when}</Chip>}</div>
   <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}>
    <div style={flex({fontFamily:DISPLAY,fontSize:qSize(a.question),fontWeight:700,lineHeight:1.04,letterSpacing:-2,maxHeight:250,overflow:'hidden'})}>{a.question}</div>
    <Proof pickers={a.pickers} lang={a.lang}/>
   </div>
   <div style={flex({justifyContent:'space-between',alignItems:'flex-end'})}>
    <div style={flex({alignItems:'flex-end'})}>{shown.map((n,i)=><div key={n+i} style={flex({flexDirection:'column',alignItems:'center',marginRight:22})}><Face name={n} size={98} ring={WHITE} i={i}/><div style={flex({marginTop:8,fontSize:24,fontWeight:700})}>{n}</div></div>)}
     {more>0&&<div style={flex({flexDirection:'column',alignItems:'center'})}><div style={flex({width:98,height:98,borderRadius:98,background:'rgba(23,32,27,0.14)',alignItems:'center',justifyContent:'center',fontFamily:DISPLAY,fontSize:34,fontWeight:700})}>+{more}</div><div style={flex({marginTop:8,fontSize:24,fontWeight:700,opacity:0})}>.</div></div>}</div>
    <Cta>{t.pick}</Cta>
   </div>
  </div>
 </>);
}
/** Yes / No or up to 4 options as big tappable-looking buttons. */
function Choice({a}:{a:Extract<Art,{variant:'choice'}>}){const t=T[a.lang];const opts=a.answers.slice(0,4),many=opts.length>2;
 return frame(a.group.color,<>
  {blob({left:-140,bottom:-220,width:460,height:460,background:'rgba(255,255,255,0.2)'})}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><Brand group={a.group}/>{a.when&&<Chip>{a.when}</Chip>}</div>
   <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}>
    <div style={flex({fontFamily:DISPLAY,fontSize:qSize(a.question),fontWeight:700,lineHeight:1.04,letterSpacing:-2,maxHeight:250,overflow:'hidden'})}>{a.question}</div>
    <Proof pickers={a.pickers} lang={a.lang}/>
   </div>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}>
    <div style={flex({})}>{opts.map(o=><div key={o} style={flex({background:WHITE,border:'4px solid '+INK,boxShadow:'0 6px 0 '+INK,borderRadius:26,height:many?92:96,padding:many?'0 20px':'0 44px',marginRight:16,alignItems:'center',justifyContent:'center',textAlign:'center',fontFamily:DISPLAY,fontSize:many?(o.length>10?24:30):40,fontWeight:700,lineHeight:1.05,maxWidth:many?190:320,overflow:'hidden'})}>{o}</div>)}</div>
    <Cta>{t.pick}</Cta>
   </div>
  </div>
 </>);
}
/** "3 friends picked you for something." The question stays half hidden: curiosity does the inviting. */
function Picked({a}:{a:Extract<Art,{variant:'picked'}>}){const t=T[a.lang];const words=a.question.split(' ');const lead=words.slice(0,Math.min(3,Math.max(1,words.length-3))).join(' ');
 return frame(INK,<>
  {[[1040,70,26],[1110,150,14],[980,560,18],[620,520,12]].map(([x,y,r],i)=><div key={i} style={flex({position:'absolute',left:x,top:y,width:r*2,height:r*2,borderRadius:r*2,background:a.group.color,opacity:0.85})}/>)}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <Brand group={a.group} dark/>
   <div style={flex({flexGrow:1,alignItems:'center'})}>
    <div style={flex({position:'relative',width:250,height:250,marginRight:56})}>
     <Face name={a.subject} size={230} ring={a.group.color} i={1}/>
     {[0,1,2].slice(0,Math.min(a.count,3)).map(i=><div key={i} style={flex({position:'absolute',left:[150,190,120][i],top:[-18,70,170][i],width:70,height:70,borderRadius:70,background:WHITE,border:'5px solid '+INK,alignItems:'center',justifyContent:'center',fontFamily:DISPLAY,fontSize:36,fontWeight:700,color:INK})}>?</div>)}
    </div>
    <div style={flex({flexDirection:'column',flexGrow:1})}>
     <div style={flex({fontFamily:DISPLAY,fontSize:74,fontWeight:700,lineHeight:1.02,letterSpacing:-2,flexWrap:'wrap'})}>{[...t.picked(a.count).split(' ').map(w=>[w,false] as const),[t.you,true] as const,...t.forSomething.split(' ').map(w=>[w,false] as const)].map(([w,hi],i)=><span key={i} style={{marginRight:20,color:hi?a.group.color:undefined}}>{w}</span>)}</div>
     <div style={flex({alignItems:'center',marginTop:28})}><div style={flex({fontSize:32,color:'rgba(255,255,255,0.75)',fontWeight:700,marginRight:14})}>“{lead}</div>{[150,90,120].map((w,i)=><div key={i} style={flex({width:w,height:26,borderRadius:13,background:'rgba(255,255,255,0.22)',marginRight:10})}/>)}<div style={flex({fontSize:32,color:'rgba(255,255,255,0.75)',fontWeight:700})}>?”</div></div>
    </div>
   </div>
   <div style={flex({justifyContent:'flex-end'})}><Cta color={a.group.color} text={INK}>{t.open}</Cta></div>
  </div>
 </>,WHITE);
}
/** The result: who saw it coming. No points on shared cards, just the bragging. */
function Result({a}:{a:Extract<Art,{variant:'result'}>}){const t=T[a.lang];const confetti=[[80,120,'#FF8A5B',20],[300,60,'#7CC0FF',-15],[520,40,WHITE,30],[1060,140,'#B9A2FF',-25],[980,520,'#FF8EC2',15],[700,560,WHITE,-30],[140,520,'#FFC94D',25],[1120,330,WHITE,10]] as const;
 return frame(a.group.color,<>
  {confetti.map(([x,y,c,r],i)=><div key={i} style={flex({position:'absolute',left:x,top:y,width:34,height:14,borderRadius:4,background:c,transform:`rotate(${r}deg)`})}/>)}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <Brand group={a.group}/>
   <div style={flex({flexGrow:1,alignItems:'center'})}>
    <div style={flex({marginRight:44})}>{a.winners.slice(0,3).map((n,i)=><div key={n} style={flex({marginLeft:i?-60:0})}><Face name={n} size={a.winners.length>1?170:220} ring={WHITE} i={i}/></div>)}</div>
    <div style={flex({flexDirection:'column',flexGrow:1})}>
     <div style={flex({fontSize:30,fontWeight:700,opacity:0.75,maxHeight:80,overflow:'hidden'})}>{a.question}</div>
     <div style={flex({fontFamily:DISPLAY,fontSize:a.winners.join(' ').length>14?92:120,fontWeight:700,lineHeight:1,letterSpacing:-3,marginTop:6})}>{a.winners.length===1?a.winners[0]:a.winners.slice(0,2).join(' & ')}</div>
     <div style={flex({fontFamily:DISPLAY,fontSize:64,fontWeight:700,letterSpacing:-2})}>{t.calledIt}</div>
     <div style={flex({alignItems:'center',marginTop:16})}><div style={flex({background:INK,color:a.group.color,borderRadius:30,padding:'8px 20px',fontSize:28,fontWeight:700,marginRight:16})}>{t.answer}: {a.answer}</div><div style={flex({fontSize:28,fontWeight:700})}>{t.sawIt(a.right,a.total)}</div></div>
    </div>
   </div>
  </div>
 </>);
}
function Invite({a}:{a:Extract<Art,{variant:'invite'}>}){const t=T[a.lang];
 return frame(a.group.color,<>
  {blob({right:-160,bottom:-200,width:560,height:560,background:'rgba(255,255,255,0.22)'})}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><div style={flex({background:INK,color:a.group.color,borderRadius:40,padding:'8px 22px',fontFamily:DISPLAY,fontSize:30,fontWeight:700})}>{BRAND}</div><Chip>{t.free}</Chip></div>
   <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}>
    <div style={flex({fontSize:32,fontWeight:700,opacity:0.7})}>{t.invited}</div>
    <div style={flex({fontFamily:DISPLAY,fontSize:a.group.name.length>18?92:128,fontWeight:700,lineHeight:1,letterSpacing:-4})}>{a.group.name}</div>
   </div>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}>
    <div style={flex({alignItems:'center'})}>{a.members.slice(0,6).map((n,i)=><div key={n+i} style={flex({marginLeft:i?-18:0})}><Face name={n} size={84} ring={WHITE} i={i}/></div>)}<div style={flex({marginLeft:20,fontSize:28,fontWeight:700})}>{t.waiting(a.members.length)}</div></div>
    <Cta>{t.join}</Cta>
   </div>
  </div>
 </>);
}
/** A Moment before it starts: the occasion, its first calls, who's in. */
function Moment({a}:{a:Extract<Art,{variant:'moment'}>}){const t=T[a.lang];const shown=a.questions.slice(0,3),more=a.questions.length-shown.length;
 return frame(a.group.color,<>
  {blob({right:-150,top:-170,width:470,height:470,background:'rgba(255,255,255,0.22)'})}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><Brand group={a.group}/><Chip>{t.kinds[a.kind]||t.kinds.own} · {a.when}</Chip></div>
   <div style={flex({flexGrow:1,flexDirection:'column',justifyContent:'center'})}>
    <div style={flex({fontFamily:DISPLAY,fontSize:a.title.length>26?62:78,fontWeight:700,lineHeight:1.02,letterSpacing:-2,marginBottom:18})}>{a.title}</div>
    {shown.map((q,i)=><div key={i} style={flex({alignItems:'center',marginTop:8})}><div style={flex({width:40,height:40,borderRadius:40,background:INK,color:a.group.color,alignItems:'center',justifyContent:'center',fontFamily:DISPLAY,fontSize:22,fontWeight:700,marginRight:16})}>{i+1}</div><div style={flex({fontSize:28,fontWeight:700,maxWidth:980,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'})}>{q}</div></div>)}
    {more>0&&<div style={flex({fontSize:24,fontWeight:700,opacity:0.7,marginTop:10,marginLeft:56})}>{t.more(more)}</div>}
   </div>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}>
    <div style={flex({alignItems:'center'})}>{a.pickers.slice(0,5).map((n,i)=><div key={n+i} style={flex({marginLeft:i?-16:0})}><Face name={n} size={60} ring={WHITE} i={i}/></div>)}<div style={flex({marginLeft:a.pickers.length?18:0,fontSize:26,fontWeight:700,opacity:0.8})}>{a.pickers.length?T[a.lang].inAlready(a.pickers.slice(0,2),Math.max(0,a.pickers.length-2)):t.calls(a.questions.length)}</div></div>
    <Cta>{t.makeCalls}</Cta>
   </div>
  </div>
 </>);
}
/** After the Moment: who called it best. */
function MomentResult({a}:{a:Extract<Art,{variant:'momentResult'}>}){const t=T[a.lang];const confetti=[[90,110,'#FF8A5B',20],[330,70,'#7CC0FF',-15],[560,30,WHITE,30],[1070,150,'#B9A2FF',-25],[990,530,'#FF8EC2',15],[720,560,WHITE,-30],[150,530,'#FFC94D',25],[1120,320,WHITE,10]] as const;
 return frame(a.group.color,<>
  {confetti.map(([x,y,c,r],i)=><div key={i} style={flex({position:'absolute',left:x,top:y,width:34,height:14,borderRadius:4,background:c,transform:`rotate(${r}deg)`})}/>)}
  <div style={flex({position:'absolute',left:56,right:56,top:46,bottom:46,flexDirection:'column'})}>
   <div style={flex({justifyContent:'space-between',alignItems:'center'})}><Brand group={a.group}/><Chip>{t.kinds[a.kind]||t.kinds.own}</Chip></div>
   <div style={flex({flexGrow:1,alignItems:'center'})}>
    <div style={flex({marginRight:44})}>{a.winners.slice(0,3).map((n,i)=><div key={n} style={flex({marginLeft:i?-60:0})}><Face name={n} size={a.winners.length>1?170:220} ring={WHITE} i={i}/></div>)}</div>
    <div style={flex({flexDirection:'column',flexGrow:1})}>
     <div style={flex({fontSize:30,fontWeight:700,opacity:0.75})}>{t.oracleOf(a.title)}</div>
     <div style={flex({fontFamily:DISPLAY,fontSize:a.winners.join(' ').length>14?92:120,fontWeight:700,lineHeight:1,letterSpacing:-3,marginTop:6})}>{a.winners.length===1?a.winners[0]:a.winners.slice(0,2).join(' & ')}</div>
     <div style={flex({marginTop:20})}><div style={flex({background:INK,color:a.group.color,borderRadius:30,padding:'10px 22px',fontSize:30,fontWeight:700})}>{t.knew(a.right,a.of)}</div></div>
    </div>
   </div>
  </div>
 </>);
}
export function renderArt(a:Art){bg=a.variant==='picked'?'':a.group.color;
 switch(a.variant){case 'friend':return <Friend a={a}/>;case 'choice':return <Choice a={a}/>;case 'picked':return <Picked a={a}/>;case 'result':return <Result a={a}/>;case 'invite':return <Invite a={a}/>;case 'moment':return <Moment a={a}/>;case 'momentResult':return <MomentResult a={a}/>}
}
