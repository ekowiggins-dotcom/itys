import {test,after} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,identity,view} from '../lib/service';import {runScheduler} from '../lib/scheduler';import {rankStandings} from '../lib/rounds';import {scoreTenths} from '../lib/rules';
const folder=await mkdtemp(join(tmpdir(),'weekly-loop-'));process.env.PREDICTION_DATA_DIR=folder;after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
const DAY=86400000,base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');const at=(days=0,hours=0)=>new Date(monday.getTime()+days*DAY+hours*3600000);
async function fixture(count=3){const owner=await execute({action:'create',name:'Owner',groupName:'Weekly crew'},undefined,base);const invite=owner.invite!;const tokens=[owner.session!];for(let i=1;i<count;i++)tokens.push((await execute({action:'join',invite,name:'Friend '+i},undefined,base)).session!);const ids=await Promise.all(tokens.map(async t=>(await identity(t))!.id));await runScheduler(monday);return {invite,tokens,ids};}
async function question(f:Awaited<ReturnType<typeof fixture>>,creator=0,text='Will it happen?'){return(await execute({action:'question',invite:f.invite,text,locksAt:at(0,1).toISOString()},f.tokens[creator],monday)).questionId!}
async function predict(f:Awaited<ReturnType<typeof fixture>>,q:string,index:number,answer:string,stake=20){return execute({action:'predict',invite:f.invite,questionId:q,answer,stake},f.tokens[index],monday)}
test('lock snapshot is immutable; scores use snapshot shares and decimal totals rounded once',async()=>{
 assert.equal(scoreTenths(20,2,5),320);assert.equal(scoreTenths(20,1,1),200);assert.equal(scoreTenths(5,1,3),83);
 const f=await fixture(5),q=await question(f);for(let i=0;i<5;i++)await predict(f,q,i,i<2?'yes':'no');
 assert.equal((await view(f.invite,f.tokens[0],undefined,monday)).snapshots?.length,0);
 await runScheduler(at(0,1));const d=await db();
 await assert.rejects(d.query("UPDATE locked_predictions SET answer='no' WHERE question_id=$1",[q]),/immutable/);
 await d.query("UPDATE predictions SET answer='no' WHERE question_id=$1 AND user_id=$2",[q,f.ids[1]]);
 await execute({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.tokens[0],at(0,2));await runScheduler(at(1,2));
 assert.equal((await d.query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1 AND user_id=$2',[q,f.ids[0]])).rows[0].points_tenths,320);
 const f2=await fixture(),a=await question(f2),b=await question(f2,0,'Will another thing happen?');
 for(const id of [a,b])for(let i=0;i<3;i++)await predict(f2,id,i,i===0?'yes':'no',5);
 for(const id of [a,b])await execute({action:'propose',invite:f2.invite,questionId:id,answer:'yes'},f2.tokens[0],at(0,2));
 await runScheduler(at(1,2));const state=await view(f2.invite,f2.tokens[0],undefined,at(1,2));assert.equal(state.roundScores?.find(s=>s.user_id===f2.ids[0])?.points_tenths,167);
});
test('named fallback judges conflicts; takeover and detailed audit are enforced',async()=>{
 const f=await fixture(),q=await question(f);await predict(f,q,1,'yes');
 await execute({action:'judgeSettings',invite:f.invite,targetId:f.ids[2]},f.tokens[0],monday);
 await execute({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.tokens[0],at(0,2));await execute({action:'dispute',invite:f.invite,questionId:q},f.tokens[1],at(0,3));
 await assert.rejects(execute({action:'judge',invite:f.invite,questionId:q,answer:'yes'},f.tokens[0],at(0,4)),/eligible judge/);
 await execute({action:'judge',invite:f.invite,questionId:q,answer:'no'},f.tokens[2],at(0,4));
 const d=await db();assert.equal((await d.query<{result_answer:string}>('SELECT result_answer FROM questions WHERE id=$1',[q])).rows[0].result_answer,'no');
 const trail=(await d.query<{action:string;details:{answer:string}}>('SELECT action,details FROM audit WHERE question_id=$1',[q])).rows;assert.ok(trail.some(a=>a.action==='judge'&&a.details.answer==='no'));
 const f2=await fixture(),q2=await question(f2,1);await predict(f2,q2,0,'yes');await execute({action:'leave',invite:f2.invite},f2.tokens[1],at(0,2));await execute({action:'propose',invite:f2.invite,questionId:q2,answer:'yes'},f2.tokens[0],at(0,3));
 assert.equal((await d.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q2])).rows[0].state,'proposed');
});
test('provisional round becomes final after deadline void, while the next round opens on schedule',async()=>{
 const f=await fixture(),q=await question(f);await predict(f,q,0,'yes',25);const first=(await view(f.invite,f.tokens[0],undefined,monday)).selectedRound!;
 await runScheduler(at(7,12));let old=await view(f.invite,f.tokens[0],first.id,at(7,12));assert.equal(old.selectedRound?.state,'provisional');assert.equal(old.selectedRound?.winners.length,0);assert.ok(old.rounds?.some(r=>new Date(r.opens_at).getTime()===at(7).getTime()&&r.state==='live'));
 await runScheduler(at(14));old=await view(f.invite,f.tokens[0],first.id,at(14));assert.equal(old.selectedRound?.state,'final');assert.equal(old.selectedRound?.winners[0].user_id,f.ids[0]);assert.equal(old.selectedRound?.winners[0].points_tenths,250);
 await runScheduler(at(14));assert.equal(Number((await(await db()).query<{count:string}>('SELECT count(*) FROM scores WHERE question_id=$1',[q])).rows[0].count),1);
});
test('Wednesday suggestions deduplicate, empty rounds skip, and paused weeks create no eligibility',async()=>{
 const f=await fixture();await runScheduler(at(2));await runScheduler(at(2));const first=(await view(f.invite,f.tokens[0],undefined,at(2))).selectedRound!;
 const d=await db();assert.equal(Number((await d.query<{count:string}>("SELECT count(*) FROM round_events WHERE round_id=$1 AND kind='suggestion'",[first.id])).rows[0].count),3);
 await execute({action:'leave',invite:f.invite},f.tokens[1],at(3));await runScheduler(at(7,12));const state=await view(f.invite,f.tokens[0],first.id,at(7,12));assert.equal(state.selectedRound?.state,'skipped');assert.equal(state.rounds?.length,1);
 await execute({action:'join',invite:f.invite},f.tokens[1],at(10));await runScheduler(at(14));const state2=await view(f.invite,f.tokens[0],undefined,at(14));assert.ok(state2.rounds?.some(r=>new Date(r.opens_at).getTime()===at(14).getTime()));assert.ok(!state2.rounds?.some(r=>new Date(r.opens_at).getTime()===at(7).getTime()));
});
test('weekly budgets reset and late entrants cannot inherit eligibility for closed rounds',async()=>{
 const f=await fixture(),ids=[];for(let i=0;i<4;i++){const q=await question(f,0,'Will plan '+i+' happen?');ids.push(q);await predict(f,q,0,'yes',i===3?10:30)}
 const first=(await view(f.invite,f.tokens[0],undefined,monday)).selectedRound!;assert.equal((await view(f.invite,f.tokens[0],undefined,monday)).used,100);
 await runScheduler(at(7));const next=(await execute({action:'question',invite:f.invite,text:'New week?',locksAt:at(8).toISOString()},f.tokens[0],at(7))).questionId!;await execute({action:'predict',invite:f.invite,questionId:next,answer:'yes',stake:30},f.tokens[0],at(7));assert.equal((await view(f.invite,f.tokens[0],undefined,at(7))).used,30);assert.equal((await view(f.invite,f.tokens[0],first.id,at(7))).used,100);
 const newcomer=await execute({action:'join',invite:f.invite,name:'Late arrival'},undefined,at(7));const newcomerId=(await identity(newcomer.session))!.id;assert.equal((await(await db()).query('SELECT 1 FROM round_members WHERE round_id=$1 AND user_id=$2',[first.id,newcomerId])).rows.length,0);
});
test('displayed-score ties use exact-score counts then share the winner',()=>{
 const rows=rankStandings([{user_id:'a',name:'A',active:true,points_tenths:100,exact_correct:0},{user_id:'b',name:'B',active:true,points_tenths:100,exact_correct:1},{user_id:'c',name:'C',active:true,points_tenths:100,exact_correct:1}]);assert.deepEqual(rows.map(r=>[r.user_id,r.rank]),[['b',1],['c',1],['a',3]]);
});
