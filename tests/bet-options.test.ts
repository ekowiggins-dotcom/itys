import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,identity,view} from '../lib/service';import {runScheduler} from '../lib/scheduler';
import {cleanOptions,validAnswer} from '../lib/football/rules';
const folder=await mkdtemp(join(tmpdir(),'bet-options-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
const DAY=86400000,base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');
const at=(days=0,hours=0)=>new Date(monday.getTime()+days*DAY+hours*3600000);
async function fixture(count=4){
 const owner=await execute({action:'create',name:'Owner',groupName:'Options crew'},undefined,base);const invite=owner.invite!;const tokens=[owner.session!];
 for(let i=1;i<count;i++)tokens.push((await execute({action:'join',invite,name:'P'+i},undefined,base)).session!);
 const ids=await Promise.all(tokens.map(async t=>(await identity(t))!.id));return {invite,tokens,ids};
}
const ask=(f:Awaited<ReturnType<typeof fixture>>,options?:string[])=>execute({action:'question',invite:f.invite,text:'Who arrives last on Saturday?',locksAt:at(0,1).toISOString(),options},f.tokens[0],monday);

test('option lists are cleaned and validated',()=>{
 assert.equal(cleanOptions(undefined),null);assert.equal(cleanOptions(['',' ']),null);
 assert.deepEqual(cleanOptions([' Mert ','Can','  Deniz  Y ']),['Mert','Can','Deniz Y']);
 assert.throws(()=>cleanOptions(['Only one']),/2 to 4/);
 assert.throws(()=>cleanOptions(['a','b','c','d','e']),/2 to 4/);
 assert.throws(()=>cleanOptions(['Mert','mert']),/different/);
 assert.throws(()=>cleanOptions(['x'.repeat(41),'b']),/40 characters/);
 assert.ok(validAnswer('custom','yes')&&!validAnswer('custom','Mert'));
 assert.ok(validAnswer('custom','Mert',['Mert','Can'])&&!validAnswer('custom','yes',['Mert','Can']));
});

test('a 4-option bet accepts only its options, scores by crowd share and resolves by option',async()=>{
 const f=await fixture(),q=(await ask(f,['Mert','Can','Deniz','Ece'])).questionId!;
 const v=await view(f.invite,f.tokens[1],undefined,monday);
 assert.deepEqual(v.questions.find(x=>x.id===q)?.options,['Mert','Can','Deniz','Ece']);
 await assert.rejects(execute({action:'predict',invite:f.invite,questionId:q,answer:'yes',stake:20},f.tokens[1],monday),/valid answer/);
 for(const [i,a] of [[0,'Mert'],[1,'Mert'],[2,'Can'],[3,'Deniz']] as const)await execute({action:'predict',invite:f.invite,questionId:q,answer:a,stake:20},f.tokens[i],monday);
 await runScheduler(at(0,1));
 await assert.rejects(execute({action:'propose',invite:f.invite,questionId:q,answer:'Fatma'},f.tokens[0],at(0,2)),/options/);
 await execute({action:'propose',invite:f.invite,questionId:q,answer:'Can'},f.tokens[0],at(0,2));
 await runScheduler(at(1,3));
 const d=await db();
 const scores=Object.fromEntries((await d.query<{user_id:string;points_tenths:number}>('SELECT user_id,points_tenths FROM scores WHERE question_id=$1',[q])).rows.map(r=>[r.user_id,r.points_tenths]));
 // Can was picked by 1 of 4 and alone: 10 + 30 x 3/4 = 33, +10 lone = 43. Wrong picks score 0.
 assert.equal(scores[f.ids[2]],430);assert.equal(scores[f.ids[0]],0);assert.equal(scores[f.ids[3]],0);
 assert.equal((await d.query<{result_answer:string}>('SELECT result_answer FROM questions WHERE id=$1',[q])).rows[0].result_answer,'Can');
});

test('yes/no bets keep working and invalid option lists are rejected on create',async()=>{
 const f=await fixture(3);
 await assert.rejects(ask(f,['Solo']),/2 to 4/);
 const q=(await ask(f)).questionId!;
 await execute({action:'predict',invite:f.invite,questionId:q,answer:'yes',stake:10},f.tokens[1],monday);
 await assert.rejects(execute({action:'predict',invite:f.invite,questionId:q,answer:'Mert',stake:10},f.tokens[2],monday),/valid answer/);
});

test('long-term bets support options for predicting and judging',async()=>{
 const f=await fixture(4),now=at(0,2);
 const q=(await execute({action:'longterm',invite:f.invite,text:'Who gets engaged first?',locksAt:at(10).toISOString(),eventAt:at(60).toISOString(),options:['Can','Mert','Nobody']},f.tokens[0],now)).questionId!;
 await assert.rejects(execute({action:'predictLongterm',invite:f.invite,questionId:q,answer:'yes'},f.tokens[1],now),/options/);
 await execute({action:'predictLongterm',invite:f.invite,questionId:q,answer:'Nobody'},f.tokens[1],now);
 const d=await db();assert.equal((await d.query<{answer:string}>('SELECT answer FROM predictions WHERE question_id=$1 AND user_id=$2',[q,f.ids[1]])).rows[0].answer,'Nobody');
});
