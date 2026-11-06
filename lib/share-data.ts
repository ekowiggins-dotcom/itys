import {stampDataUri} from './stamp';
import {type Art,type Lang} from './share-art';
import {groupColor} from './colors';
export {groupColor};
import {momentTable} from './moment-table';
import {db} from './db';import {reconcile} from './service';import {weeklyViews} from './rounds';import {betCard,inviteCard,winnerCard} from './sharing';import {when,kickLabel} from '../app/format';
const MARKETS:Record<string,string[]>={result:['Home','Draw','Away']};
/** Month a long-running call resolves, e.g. "We'll know in March". */
export function knowLabel(eventAt:Date|string,zone='UTC'){return 'We’ll know in '+new Date(eventAt).toLocaleDateString('en-GB',{timeZone:zone,month:'long'})}
export async function publicShare(invite:string,target:{questionId?:string;roundId?:string;winner?:boolean},now=new Date()){
 await reconcile(invite,now);const d=await db();
 return d.transaction(async tx=>{
 const group=(await tx.query<{id:string;name:string;timezone:string}>('SELECT id,name,timezone FROM groups WHERE invite=$1',[invite])).rows[0];if(!group)throw Error('Share link not found.');
 if(target.winner){const round=(await weeklyViews(tx,group.id)).find(r=>r.id===target.roundId);if(!round)throw Error('Round not found.');return{card:winnerCard(group.name,round),roundId:round.id};}
 if(!target.questionId){
  // A group invite shows first names only: the people you'd be joining.
  const members=(await tx.query<{name:string}>('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.active ORDER BY m.joined_at LIMIT 30',[group.id])).rows.map(r=>r.name);
  return{card:inviteCard(group.name,members)};
 }
 const q=(await tx.query<{id:string;text:string;market:string;options:string[]|null;round_id:string|null;scope:string;locks_at:Date;event_at:Date|null;creator_name:string;picked:number;subject_id:string|null}>("SELECT q.id,q.text,q.market,q.options,q.subject_id,q.round_id,q.scope,q.locks_at,q.event_at,u.name creator_name,(SELECT count(*)::int FROM predictions p WHERE p.question_id=q.id) picked FROM questions q JOIN users u ON u.id=q.creator WHERE q.id=$1 AND q.group_id=$2 AND NOT q.superseded AND q.moderation_state='visible'",[target.questionId,group.id])).rows[0];if(!q)throw Error('Call not found.');
 // Previews show the question, its answers, who made it and how many are in: never who picked what, or how many points.
 const market=q.market||'custom';const options=market==='custom'?(q.options?.length?q.options:['Yes','No']):MARKETS[market]||['Yes','No'];
 const locked=now>=new Date(q.locks_at);
 const label=q.scope==='longterm'&&q.event_at?knowLabel(q.event_at,group.timezone):locked?'Picks are closed':'Picks close '+when(q.locks_at,now.getTime(),group.timezone);
 // A shared match: "Fenerbahçe – Liverpool" with the teams as the answers.
 if(market!=='custom'){const f=(await tx.query<{home:string;away:string;kickoff:Date;league_name:string}>('SELECT f.home,f.away,f.kickoff,f.league_name FROM football_fixtures f JOIN questions q ON q.fixture_id=f.id WHERE q.id=$1',[q.id])).rows[0];
  if(f){const opts=[f.home,'Draw',f.away];const card=betCard(group.name,f.home+' – '+f.away,q.picked,opts,{when:locked?'Kicked off':kickLabel(f.kickoff,now,group.timezone)});card.subtitle=f.league_name;card.teams=[f.home,f.away];return{card,questionId:q.id,roundId:q.round_id||undefined};}}
 // A call about someone is shared to a chat they're probably in: the preview keeps it secret.
 if(q.subject_id&&!['settled','void'].includes((await tx.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q.id])).rows[0].state)){const card=betCard(group.name,'A secret call about a friend',q.picked,['Open it to see'],{creator:market==='custom'?q.creator_name:undefined,when:label});card.options=[];return{card,questionId:q.id,roundId:q.round_id||undefined};}
 return{card:betCard(group.name,q.text,q.picked,options,{creator:market==='custom'?q.creator_name:undefined,when:label}),questionId:q.id,roundId:q.round_id||undefined};
 });
}

// ── New cards (lib/share-art.tsx): the group's colour and language, friends' faces, the result ──
const YES_NO:Record<Lang,Record<string,string>>={en:{yes:'Yes',no:'No'},tr:{yes:'Evet',no:'Hayır'}};
/** "Closes tonight 21:00" / "Bu akşam 21:00’de kapanıyor". */
export function closesLabel(at:Date,now:Date,zone:string,lang:Lang){
 if(now>=at)return lang==='tr'?'Seçimler kapandı':'Picks are closed';
 const day=(d:Date)=>d.toLocaleDateString('en-CA',{timeZone:zone}),hm=at.toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
 const tomorrow=new Date(now.getTime()+86400000);
 if(day(at)===day(now))return lang==='tr'?(Number(hm.slice(0,2))>=17?`Bu akşam ${hm}’de kapanıyor`:`Bugün ${hm}’de kapanıyor`):(Number(hm.slice(0,2))>=17?`Closes tonight ${hm}`:`Closes today ${hm}`);
 if(day(at)===day(tomorrow))return lang==='tr'?`Yarın ${hm}’de kapanıyor`:`Closes tomorrow ${hm}`;
 const wd=at.toLocaleDateString(lang==='tr'?'tr-TR':'en-GB',{timeZone:zone,weekday:'long'});
 return lang==='tr'?`${wd} kapanıyor`:`Closes ${wd}`;
}
/** The picture for a shared link, or null to fall back to the older cards (weekly winner, football, secret calls). */
export async function shareArt(invite:string,target:{questionId?:string;roundId?:string;winner?:boolean;forName?:string;momentId?:string;reveal?:boolean},now=new Date()):Promise<Art|null>{
 if(target.winner)return null;const d=await db();
 const g=(await d.query<{id:string;name:string;color:string|null;lang:string;timezone:string}>('SELECT id,name,color,lang,timezone FROM groups WHERE invite=$1',[invite])).rows[0];if(!g)return null;
 const lang:Lang=g.lang==='tr'?'tr':'en';
 // Join order, so every face on the card has the colour it has in the app.
 const order=(await d.query<{name:string}>('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 ORDER BY m.joined_at',[g.id])).rows.map(r=>r.name);
 const group={name:g.name,color:groupColor(g.name,g.color),order};
 if(target.momentId)return momentArt(g,target.momentId,lang,group,now);
 if(!target.questionId){const members=(await d.query<{name:string}>('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.active ORDER BY m.joined_at LIMIT 30',[g.id])).rows.map(r=>r.name);return{variant:'invite',lang,group,members}}
 const q=(await d.query<{id:string;text:string;options:string[]|null;answer_type:string;market:string|null;locks_at:Date;state:string;result_answer:string|null;subject_id:string|null;moderation_state:string}>("SELECT id,text,options,answer_type,market,locks_at,state,result_answer,subject_id,moderation_state FROM questions WHERE id=$1 AND group_id=$2 AND NOT superseded",[target.questionId,g.id])).rows[0];
 if(!q||q.moderation_state!=='visible'||(q.market&&q.market!=='custom'))return null;
 if(q.subject_id&&!['settled','void'].includes(q.state))return null;// secret: the older card keeps it secret
 const friend=q.answer_type==='friend',label=(a:string)=>friend||q.options?.length?a:YES_NO[lang][a]||a;
 if(q.state==='settled'&&q.result_answer){
  const locked=(await d.query<{name:string;answer:string}>('SELECT u.name,lp.answer FROM locked_predictions lp JOIN users u ON u.id=lp.user_id WHERE lp.question_id=$1',[q.id])).rows;
  const winners=locked.filter(r=>r.answer===q.result_answer).map(r=>r.name);
  // The called-it stamp carries the day picks closed: proof they said it before it happened.
  if(winners.length)return{variant:'result',lang,group,question:q.text,answer:label(q.result_answer),winners,right:winners.length,total:locked.length,stamp:await stampDataUri(new Date(q.locks_at),g.timezone)};
  return null;
 }
 if(q.state==='void')return null;
 const sealedQ=(await d.query('SELECT 1 FROM moments m JOIN questions q ON q.moment_id=m.id WHERE q.id=$1 AND m.sealed AND m.opens_at>$2',[q.id,now])).rows.length>0;
 // The reveal, once picks are closed: how many said each friend, never who said what. Calls about someone stay
 // closed until settled (checked above), and sealed calls until they open.
 if(friend&&target.reveal&&!sealedQ&&now>=new Date(q.locks_at)){
  const rows=(await d.query<{name:string;count:number}>('SELECT answer AS name,count(*)::int AS count FROM locked_predictions WHERE question_id=$1 GROUP BY answer ORDER BY count(*) DESC,answer',[q.id])).rows;
  const total=rows.reduce((n,r)=>n+r.count,0);if(total>=2)return{variant:'reveal',lang,group,question:q.text,rows,total};
 }
 if(friend&&target.forName&&!sealedQ){const n=(await d.query<{n:number}>('SELECT count(*)::int n FROM predictions WHERE question_id=$1 AND lower(answer)=lower($2)',[q.id,target.forName])).rows[0].n;
  if(n>0&&q.options?.some(o=>o.toLocaleLowerCase('tr')===target.forName!.toLocaleLowerCase('tr')))return{variant:'picked',lang,group,subject:target.forName,count:n,question:q.text};}
 // Who's in (names only, never what they picked), first to last.
 const pickers=(await d.query<{name:string}>('SELECT u.name FROM predictions p JOIN users u ON u.id=p.user_id WHERE p.question_id=$1 ORDER BY p.submitted_at',[q.id])).rows.map(r=>r.name);
 const when=closesLabel(new Date(q.locks_at),now,g.timezone,lang);
 if(friend)return{variant:'friend',lang,group,question:q.text,answers:q.options||[],pickers,when};
 return{variant:'choice',lang,group,question:q.text,answers:(q.options?.length?q.options:['yes','no']).map(label),pickers,when};
}

/** A Moment's card: before it's settled, its calls and who's in; once every call is settled, who called it best. */
async function momentArt(g:{id:string;timezone:string},momentId:string,lang:Lang,group:{name:string;color:string},now:Date):Promise<Art|null>{
 const d=await db();const m=(await d.query<{id:string;title:string;kind:string;starts_at:Date;sealed:boolean;opens_at:Date|null}>('SELECT id,title,kind,starts_at,sealed,opens_at FROM moments WHERE id=$1 AND group_id=$2',[momentId,g.id])).rows[0];if(!m)return null;
 const qs=(await d.query<{id:string;text:string;state:string}>("SELECT id,text,state FROM questions WHERE moment_id=$1 AND NOT superseded AND moderation_state='visible' ORDER BY moment_pos",[m.id])).rows;if(!qs.length)return null;
 const done=qs.every(q=>['settled','void'].includes(q.state))&&qs.some(q=>q.state==='settled');
 if(done){const t=momentTable(await d.query<{user_id:string;name:string;points:number;right:number}>(`SELECT s.user_id,u.name,sum(s.points_tenths)::int points,count(*) FILTER (WHERE s.points_tenths>0)::int "right" FROM scores s JOIN users u ON u.id=s.user_id JOIN questions q ON q.id=s.question_id WHERE q.moment_id=$1 AND q.state='settled' GROUP BY s.user_id,u.name`,[m.id]).then(r=>r.rows));
  if(t.winners.length)return{variant:'momentResult',lang,group,title:m.title,kind:m.kind,winners:t.winners.map(w=>w.name),right:t.winners[0].right,of:qs.filter(q=>q.state==='settled').length};return null;}
 const pickers=(await d.query<{name:string}>('SELECT u.name FROM predictions p JOIN users u ON u.id=p.user_id JOIN questions q ON q.id=p.question_id WHERE q.moment_id=$1 GROUP BY u.name ORDER BY min(p.submitted_at)',[m.id])).rows.map(r=>r.name);
 const at=new Date(m.starts_at),label=closesLabel(at,now,g.timezone,lang);
 const loc=lang==='tr'?'tr-TR':'en-GB',soon=at.getTime()-now.getTime()<6*86400000;
 const when=now>=at?label:at.toLocaleDateString(loc,soon?{timeZone:g.timezone,weekday:'long'}:{timeZone:g.timezone,day:'numeric',month:'long'})+' '+at.toLocaleTimeString('en-GB',{timeZone:g.timezone,hour:'2-digit',minute:'2-digit'});
 const sealed=m.sealed&&m.opens_at?{opens:new Date(m.opens_at).toLocaleDateString(loc,{timeZone:g.timezone,day:'numeric',month:'long',year:'numeric'}),closed:now>=at}:undefined;
 return{variant:'moment',lang,group,title:m.title,kind:m.kind,when,questions:qs.map(q=>q.text),pickers,sealed};
}
