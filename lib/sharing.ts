import {BRAND_NAME} from './brand';
export type ShareCard={kind:'bet'|'winner'|'invite';groupName:string;title:string;subtitle:string;detail:string;footer:string;
 /** The call's real answers (Yes / No, or its own options). */
 options?:string[];creator?:string;picked?:number;
 /** "Picks close Today 21:00" or "We'll know in March". */
 when?:string;members?:string[]};
type Winner={name:string;points_tenths:number};
const inLine=(n:number)=>n>0?`${n} ${n===1?'friend is':'friends are'} in`:'Be the first to call it';
export function betCard(groupName:string,question:string,picked:number,options:string[]|string=['Yes','No'],extra:{creator?:string;when?:string}={}):ShareCard{
 const list=Array.isArray(options)?options:options.split(' / ');
 return{kind:'bet',groupName,title:question,subtitle:'MAKE YOUR CALL',detail:`${list.join(' / ')} · ${inLine(picked)}`,footer:'Free points. No money. Just bragging rights.',options:list,picked,creator:extra.creator,when:extra.when};
}
export function inviteCard(groupName:string,members:string[]):ShareCard{
 return{kind:'invite',groupName,title:groupName,subtitle:'JOIN THE GROUP',detail:`${members.length} ${members.length===1?'friend':'friends'} making calls every week`,footer:'Free points. No money. Just bragging rights.',members};
}
export function winnerCard(groupName:string,round:{state:string;opens_at:string|Date;winners:Winner[]}):ShareCard{
 if(round.state!=='final'||!round.winners.length)throw Error('The winner card is available only after the round is final.');
 const winners=round.winners;const title=winners.length<=3?winners.map(w=>w.name).join(' & '):winners.slice(0,2).map(w=>w.name).join(', ')+` & ${winners.length-2} others`;
 return{kind:'winner',groupName,title,subtitle:winners.length>1?'SHARED WEEKLY WIN':'THIS WEEK’S WINNER',detail:`${(winners[0].points_tenths/10).toFixed(1)} points · Final`,footer:'Week of '+new Date(round.opens_at).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'})};
}
/** Long link used inside the app and by older shares. New shares use short links (lib/short-links.ts). */
export function shareLink(origin:string,invite:string,target?:{questionId?:string;roundId?:string;winner?:boolean},demo=false){
 const parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol))throw Error('A web URL is required.');
 const path=demo||!target?'/':target.winner?'/share/winner':'/share/call';const url=new URL(path,parsed.origin);url.searchParams.set('invite',invite);
 if(target?.questionId)url.searchParams.set('question',target.questionId);
 if(target?.roundId)url.searchParams.set('round',target.roundId);
 if(target?.winner)url.searchParams.set('view','winner');
 return url.toString();
}
/** One short message: the link preview carries the picture, so the text doesn't repeat it. */
export function shareText(card:ShareCard,url:string,from?:string){
 if(card.kind==='bet')return `${card.title}\nWho’s in? ${url}`;
 if(card.kind==='invite')return `${from?from+' invited you to ':'Join '}${card.groupName} on ${BRAND_NAME}. Free, no money, just calls. ${url}`;
 return `${card.title} ${card.subtitle==='SHARED WEEKLY WIN'?'share the weekly win':'wins this week'} in ${card.groupName}!\n${card.detail}\n${card.footer}\n${url}`;
}
/** Short link: https://calld.app/c/k7Qm2xa */
export function shortLink(origin:string,code:string){const parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol))throw Error('A web URL is required.');return parsed.origin+'/c/'+code}
export function whatsappLink(text:string){return 'https://wa.me/?text='+encodeURIComponent(text)}
