export type ShareCard={kind:'bet'|'winner';groupName:string;title:string;subtitle:string;detail:string;footer:string};
type Winner={name:string;points_tenths:number};
export function betCard(groupName:string,question:string,picked:number,optionsLabel='Yes / No'):ShareCard{return{kind:'bet',groupName,title:question,subtitle:'MAKE YOUR CALL',detail:`${optionsLabel} · ${picked} ${picked===1?'friend has':'friends have'} picked`,footer:'Free confidence points. No money. No prizes.'}}
export function winnerCard(groupName:string,round:{state:string;opens_at:string|Date;winners:Winner[]}):ShareCard{
 if(round.state!=='final'||!round.winners.length)throw Error('The winner card is available only after the round is final.');
 const winners=round.winners;const title=winners.length<=3?winners.map(w=>w.name).join(' & '):winners.slice(0,2).map(w=>w.name).join(', ')+` & ${winners.length-2} others`;
 return{kind:'winner',groupName,title,subtitle:winners.length>1?'SHARED WEEKLY WIN':'THIS WEEK’S WINNER',detail:`${(winners[0].points_tenths/10).toFixed(1)} points · Final`,footer:'Week of '+new Date(round.opens_at).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'})};
}
export function shareLink(origin:string,invite:string,target?:{questionId?:string;roundId?:string;winner?:boolean},demo=false){
 const parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol))throw Error('A web URL is required.');
 const path=demo||!target?'/':target.winner?'/share/winner':'/share/bet';const url=new URL(path,parsed.origin);url.searchParams.set('invite',invite);
 if(target?.questionId)url.searchParams.set('question',target.questionId);
 if(target?.roundId)url.searchParams.set('round',target.roundId);
 if(target?.winner)url.searchParams.set('view','winner');
 return url.toString();
}
export function shareText(card:ShareCard,url:string){return card.kind==='bet'?`${card.title}\n${card.detail}\nJoin ${card.groupName} and back your prediction.\n${url}\nFree points. No real money.`:`${card.title} ${card.subtitle==='SHARED WEEKLY WIN'?'share the weekly win':'wins this week'} in ${card.groupName}!\n${card.detail}\n${card.footer}\n${url}`}
export function whatsappLink(text:string){return 'https://wa.me/?text='+encodeURIComponent(text)}
