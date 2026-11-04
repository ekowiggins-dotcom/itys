import {BRAND,BRAND_NAME} from './brand';
import {NextRequest} from 'next/server';import {publicShare} from './share-data';import {shareLink} from './sharing';import type {ShareTarget} from './short-links';
function escape(text:string){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}
export function publicOrigin(req:NextRequest){return process.env.APP_ORIGIN||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:req.nextUrl.protocol+'//'+req.headers.get('host'))}
/** Old long links: /share/call?invite=…&question=… */
export async function shareResponse(req:NextRequest,winner=false){
 const p=req.nextUrl.searchParams;
 return sharePage(req,{invite:p.get('invite')||'',questionId:p.get('question')||undefined,roundId:p.get('round')||undefined,winner},'/share/image'+req.nextUrl.search);
}
/** The page a shared link opens: rich preview tags for the chat app, then straight into the call. */
export async function sharePage(req:NextRequest,t:ShareTarget,imagePath:string){
 try{const origin=publicOrigin(req);const data=await publicShare(t.invite,{questionId:t.questionId,roundId:t.roundId,winner:t.winner});const {card}=data;
 const target=shareLink(origin,t.invite,{questionId:data.questionId,roundId:data.roundId,winner:t.winner},true);
 const image=new URL(imagePath,origin).toString();
 const title=card.kind==='bet'?card.title:card.kind==='invite'?'Join '+card.groupName+' on '+BRAND_NAME:card.title+' · '+card.detail;
 const description=card.kind==='bet'?(card.creator?card.creator+'’s call in ':'A call in ')+card.groupName+' · tap to make yours, free':card.kind==='invite'?card.detail+'. Free, no money.':card.groupName+' · '+card.detail;
 const scriptTarget=JSON.stringify(target).replace(/</g,'\\u003c');
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)} · ${BRAND_NAME}</title><meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><style>body{font-family:system-ui;background:#17201B;color:#fff;padding:7vw}main{max-width:650px}h1{font-size:40px;line-height:1.1}a{display:inline-block;background:#D7F25A;color:#17201B;padding:16px 20px;text-decoration:none;border-radius:16px;font-weight:700}</style></head><body><main><p>${BRAND} · ${escape(card.groupName)}</p><h1>${escape(card.title)}</h1><p>${escape(card.detail)}</p><a href="${escape(target)}">${t.winner?'See the final ranking':card.kind==='invite'?'Join the group':'Make your call'}</a><p>Free points. No money. No prizes.</p></main><script>location.replace(${scriptTarget})</script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){return new Response((e as Error).message,{status:(e as Error).message.includes('only after')?409:404,headers:{'Cache-Control':'no-store'}})}
}
