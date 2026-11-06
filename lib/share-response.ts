import {revealHeadline} from './share-art';
import {BRAND,BRAND_NAME} from './brand';
import {NextRequest} from 'next/server';import {publicShare,shareArt} from './share-data';import type {Art} from './share-art';import {shareLink} from './sharing';import type {ShareTarget} from './short-links';
function escape(text:string){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}
export function publicOrigin(req:NextRequest){return process.env.APP_ORIGIN||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:req.nextUrl.protocol+'//'+req.headers.get('host'))}
/** The title and line WhatsApp shows under the picture, in the group's language. */
export function artText(a:Art):{title:string;description:string}{const tr=a.lang==='tr';
 switch(a.variant){
  case 'friend':case 'choice':{
   // Curiosity, not instructions: someone has answered, we don't say what.
   const n=a.pickers.length,names=n>2?a.pickers.slice(0,2).join(', ')+(tr?' ve '+(n-2)+' kişi daha':' and '+(n-2)+' more'):a.pickers.join(tr?' ve ':' and '),friend=a.variant==='friend';
   if(!n)return{title:a.question,description:tr?(friend?'Henüz kimse seçmedi. İlk ismi sen ver.':'Henüz kimse cevaplamadı. İlk sen söyle.'):(friend?'Nobody’s picked yet. Name someone first.':'Nobody’s answered yet. Go first.')};
   return{title:a.question,description:tr?(friend?`${names} birini seçti, kimi söylemiyoruz. Sen kimi diyorsun?`:`${names} cevabını verdi, ne dediğini söylemiyoruz. Sen ne diyorsun?`):(friend?`${names} ${n===1?'has':'have'} picked someone. We’re not saying who. Who’s yours?`:`${names} ${n===1?'has':'have'} answered. We’re not saying what. What’s yours?`)}}
  case 'reveal':return{title:revealHeadline(a.rows,a.total,a.lang)+' 👀',description:a.question+(tr?' · Cevaplar açıldı. Sen kimi dedin?':' · The answers are out. Who did you say?')};
  case 'picked':return{title:tr?`${a.count} arkadaşın seni seçti`:`${a.count} ${a.count===1?'friend':'friends'} picked you`,description:tr?`${a.group.name}’da bir soru seni soruyor. Bak, sen de seç.`:`A call in ${a.group.name} is about you. Take a look, then make your own pick.`};
  case 'result':return{title:tr?`${a.winners.slice(0,2).join(' & ')} bildi: ${a.answer}`:`${a.winners.slice(0,2).join(' & ')} called it: ${a.answer}`,description:tr?`${a.total} kişiden ${a.right} kişi bildi.`:`${a.right} of ${a.total} saw it coming.`};
  case 'moment':if(a.sealed)return{title:a.title,description:a.sealed.closed?(tr?`Mühürlendi. ${a.sealed.opens}’de birlikte açıyoruz.`:`Sealed. We open it together on ${a.sealed.opens}.`):(tr?`Tahminlerini mühürle: ${a.sealed.opens}’e kadar kimse göremez.`:`Seal your calls: nobody sees them until ${a.sealed.opens}.`)};
   return{title:a.title,description:tr?`${a.questions.length} soru · ${a.when}. Tahminini yap, sonucu birlikte görelim.`:`${a.questions.length} calls · ${a.when}. Make yours, see who called it.`};
  case 'momentResult':return{title:tr?`${a.winners.slice(0,2).join(' & ')}: ${a.title} kâhini`:`${a.winners.slice(0,2).join(' & ')}: oracle of ${a.title}`,description:tr?`${a.of} sorudan ${a.right} doğru.`:`${a.right} of ${a.of} right.`};
  case 'invite':return{title:tr?`${a.group.name}’a katıl`:`Join ${a.group.name}`,description:tr?`${a.members.length} arkadaşın ${BRAND_NAME}’da tahmin yapıyor. Ücretsiz, para yok.`:`${a.members.length} friends are making calls on ${BRAND_NAME}. Free, no money.`};
 }
}
/** Old long links: /share/call?invite=…&question=… */
export async function shareResponse(req:NextRequest,winner=false){
 const p=req.nextUrl.searchParams;
 return sharePage(req,{invite:p.get('invite')||'',questionId:p.get('question')||undefined,roundId:p.get('round')||undefined,winner,reveal:p.get('r')==='1'},'/share/image'+req.nextUrl.search);
}
/** The page a shared link opens: rich preview tags for the chat app, then straight into the call. */
export async function sharePage(req:NextRequest,t:ShareTarget,imagePath:string){
 try{const origin=publicOrigin(req);const data=await publicShare(t.invite,{questionId:t.questionId,roundId:t.roundId,winner:t.winner});const {card}=data;
 const target=shareLink(origin,t.invite,{questionId:data.questionId,roundId:data.roundId,winner:t.winner},true);
 const image=new URL(imagePath,origin).toString();
 const n=card.picked||0;
 const art=await shareArt(t.invite,t);const nice=art?artText(art):null;
 const title=nice?nice.title:card.kind==='bet'?(card.teams?card.title+' · Who wins?':card.title):card.kind==='invite'?'Join '+card.groupName+' on '+BRAND_NAME:card.title+' · '+card.detail;
 const description=nice?nice.description:card.kind==='bet'?(n>0?`${n} ${n===1?'friend':'friends'} in ${card.groupName} ${n===1?'has':'have'} called it. Your turn: tap, pick, done.`:`Be the first in ${card.groupName} to call it. Free, no sign-up.`):card.kind==='invite'?card.detail+'. Free, no money.':card.groupName+' · '+card.detail;
 const scriptTarget=JSON.stringify(target).replace(/</g,'\\u003c');
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)} · ${BRAND_NAME}</title><meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><style>body{font-family:system-ui;background:#17201B;color:#fff;padding:7vw}main{max-width:650px}h1{font-size:40px;line-height:1.1}a{display:inline-block;background:#D7F25A;color:#17201B;padding:16px 20px;text-decoration:none;border-radius:16px;font-weight:700}</style></head><body><main><p>${BRAND} · ${escape(card.groupName)}</p><h1>${escape(card.title)}</h1><p>${escape(card.detail)}</p><a href="${escape(target)}">${t.winner?'See the final ranking':card.kind==='invite'?'Join the group':'Make your call'}</a><p>Free points. No money. No prizes.</p></main><script>location.replace(${scriptTarget})</script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){return new Response((e as Error).message,{status:(e as Error).message.includes('only after')?409:404,headers:{'Cache-Control':'no-store'}})}
}
