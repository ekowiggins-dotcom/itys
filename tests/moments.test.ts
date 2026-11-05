import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'moments-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,view,identity}=await import('../lib/service');const {lifecycle}=await import('../lib/lifecycle');
const {starters}=await import('../lib/moments');const {runScheduler}=await import('../lib/scheduler');const {resolveCode}=await import('../lib/short-links');
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

test('sealed predictions: written together, nothing shown until the opening, then the group opens and settles them',async()=>{
 const g=await group();const ege=await execute({action:'join',invite:g.invite,name:'Ege'});const egeId=(await identity(ege.session))!.id;
 const t0=Date.now(),seal=new Date(t0+2*86400000),open=new Date(t0+30*86400000),at=(ms:number)=>new Date(t0+ms);
 const r=await lifecycle({action:'createMoment',invite:g.invite,moment:{kind:'year',title:'2027 kehanetleri',startsAt:seal.toISOString(),sealed:true,opensAt:open.toISOString(),calls:starters('year','tr').slice(0,2).map(s=>({text:s.text,answerType:s.answerType}))}},g.me) as {momentId:string};
 // Ege adds one before the seal date.
 const added=await lifecycle({action:'addMomentCall',invite:g.invite,momentId:r.momentId,call:{text:'Deniz bu yıl maraton koşar mı?',answerType:'choice'}},egeId) as {questionId:string};
 const qs=((await view(g.invite,g.session)).bets as (Bet&{split?:unknown})[]).filter(b=>b.moment_id===r.momentId);assert.equal(qs.length,3);assert.ok(qs.every(q=>q.scope==='longterm'));
 for(const q of qs){await lifecycle({action:'predictLongterm',invite:g.invite,questionId:q.id,answer:q.answer_type==='friend'?'Ege':'yes'},g.me);await lifecycle({action:'predictLongterm',invite:g.invite,questionId:q.id,answer:q.answer_type==='friend'?'Can':'no'},egeId);}
 const v1=await view(g.invite,g.session,undefined,at(5*86400000));
 assert.ok((v1.bets as (Bet&{split?:unknown})[]).filter(b=>b.moment_id===r.momentId).every(b=>!b.split),'no split while sealed');
 assert.equal((v1.snapshots as {question_id:string}[]).filter(s=>qs.some(q=>q.id===s.question_id)).length,0,'no who-said-what while sealed');
 await assert.rejects(lifecycle({action:'addMomentCall',invite:g.invite,momentId:r.momentId,call:{text:'Too late?',answerType:'choice'}},egeId,at(3*86400000)),/sealed already/);
 await assert.rejects(lifecycle({action:'propose',invite:g.invite,questionId:added.questionId,answer:'yes'},g.me,at(10*86400000)),/These open on/);
 // Opening day: everyone is told, the answers show, and anyone in the group can say what happened.
 await runScheduler(at(30*86400000+60000));
 const n=(await (await db()).query<{n:number}>("SELECT count(*)::int n FROM notifications WHERE kind='moment_open' AND source_key=$1",['opened:'+r.momentId])).rows[0].n;assert.equal(n,2);
 const v2=await view(g.invite,g.session,undefined,at(30*86400000+120000));assert.ok((v2.snapshots as {question_id:string}[]).some(s=>s.question_id===added.questionId));
 await lifecycle({action:'propose',invite:g.invite,questionId:added.questionId,answer:'yes'},egeId,at(30*86400000+180000));
});
