import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'moments-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,view,identity}=await import('../lib/service');const {lifecycle}=await import('../lib/lifecycle');
const {starters}=await import('../lib/moments');const {resolveCode}=await import('../lib/short-links');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});
type Bet={id:string;moment_id:string|null;scope:string;locks_at:string;answer_type:string;options:string[]|null;slot:string};

async function group(){const a=await execute({action:'create',name:'Arda',groupName:'Agalar',friends:['Ege','Can','Deniz'],lang:'tr',startNow:true});const me=(await identity(a.session))!.id;return{invite:a.invite!,session:a.session!,me}}
const calls=(kind:'birthday'|'trip',who='Ege')=>starters(kind,'tr',who).map(s=>({text:s.text,answerType:s.answerType,options:s.options}));

test('starters fill in the name and come in both languages',()=>{
 assert.equal(starters('birthday','tr','Ege')[0].text,'Ege mumları ilk denemede söndürür mü?');
 assert.equal(starters('birthday','en','Ege')[0].text,'Does Ege blow out the candles in one go?');
 assert.deepEqual(starters('wedding','tr')[1].options,['2 dk’dan az','5 dk','10 dk','Hâlâ dinliyoruz']);
});

test('a Moment this week: its calls close together when it starts and leave the weekly call slots free',async()=>{
 const g=await group();const now=new Date();const v0=await view(g.invite,g.session);const deadline=new Date((v0.selectedRound as unknown as {deadline_at:string}).deadline_at);
 const startsAt=new Date(Math.min(deadline.getTime()-60000,now.getTime()+2*3600000)).toISOString();
 const r=await lifecycle({action:'createMoment',invite:g.invite,moment:{kind:'birthday',title:'Ege’nin doğum günü',subject:'Ege',startsAt,calls:calls('birthday')}},g.me) as {momentId:string;questionId:string};
 const v=await view(g.invite,g.session);const mine=(v.bets as Bet[]).filter(b=>b.moment_id===r.momentId);
 assert.equal(mine.length,3);assert.ok(mine.every(b=>b.scope==='weekly'&&b.slot==='moment'&&new Date(b.locks_at).getTime()===new Date(mine[0].locks_at).getTime()));
 assert.equal(mine.find(b=>b.answer_type==='friend')?.options?.length,4,'friend calls list Arda and the three friends');
 assert.equal(((v as unknown as {moments:{id:string;title:string}[]}).moments)[0].title,'Ege’nin doğum günü');
 for(let i=0;i<6;i++)await execute({action:'question',invite:g.invite,text:'Weekly call '+i+'?',locksAt:startsAt},g.session);
 const share=(await (await db()).query<{share_code:string}>('SELECT share_code FROM moments WHERE id=$1',[r.momentId])).rows[0].share_code;
 const target=await resolveCode(share);assert.equal(target?.momentId,r.momentId);assert.equal(target?.questionId,r.questionId,'the link opens the first call');
});

test('a Moment next month uses long-term calls that don’t count toward the three-at-a-time limit',async()=>{
 const g=await group();const startsAt=new Date(Date.now()+30*86400000).toISOString();
 const r=await lifecycle({action:'createMoment',invite:g.invite,moment:{kind:'trip',title:'Kaş',startsAt,calls:[...calls('trip'),{text:'Who swims first?',answerType:'friend'},{text:'Rain on day one?',answerType:'choice'}]}},g.me) as {momentId:string};
 const mine=((await view(g.invite,g.session)).bets as Bet[]).filter(b=>b.moment_id===r.momentId);assert.ok(mine.every(b=>b.scope==='longterm'));
 for(const b of mine)await lifecycle({action:'predictLongterm',invite:g.invite,questionId:b.id,answer:b.answer_type==='friend'?'Ege':'yes'},g.me);
 await assert.rejects(lifecycle({action:'createMoment',invite:g.invite,moment:{kind:'trip',title:'Too soon',startsAt:new Date(Date.now()+60000).toISOString(),calls:calls('trip')}},g.me),/10 minutes/);
});
