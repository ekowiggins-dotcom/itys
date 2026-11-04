import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,identity,view} from '../lib/service';import {runScheduler} from '../lib/scheduler';
const folder=await mkdtemp(join(tmpdir(),'practice-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{delete process.env.PRACTICE_GROUPS;await(await db()).close();await rm(folder,{recursive:true,force:true})});
const MIN=60000,start=new Date('2030-04-10T09:07:00Z'); // a Wednesday morning: a normal Friends round would wait until Monday
const at=(m:number)=>new Date(start.getTime()+m*MIN);

test('practice groups need the server switch',async()=>{
 delete process.env.PRACTICE_GROUPS;
 await assert.rejects(execute({action:'create',name:'A',groupName:'P',practice:true},undefined,start),/turned off/);
});

test('a whole practice week runs in an hour; normal groups keep the weekly schedule',async()=>{
 process.env.PRACTICE_GROUPS='1';
 const a=await execute({action:'create',name:'Ana',groupName:'Practice crew',practice:true,timezone:'Europe/Istanbul'},undefined,start),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Ben'},undefined,start);
 const c=await execute({action:'join',invite,name:'Cem'},undefined,at(1));
 const v=await view(invite,a.session,undefined,at(1));
 assert.equal(v.selectedRound?.state,'live','the round opens as soon as the third friend joins');
 assert.equal(v.timing?.practice,true);
 // Calls lock by +45 min after the round opened.
 await assert.rejects(execute({action:'question',invite,text:'Too late?',locksAt:at(50).toISOString()},a.session,at(2)),/lock time/);
 const q=(await execute({action:'question',invite,text:'Will Cem be late?',locksAt:at(4).toISOString()},a.session,at(2))).questionId!;
 await execute({action:'predict',invite,questionId:q,answer:'yes',stake:20},b.session,at(3));
 await execute({action:'predict',invite,questionId:q,answer:'no',stake:20},c.session,at(3));
 await runScheduler(at(5)); // locked
 await execute({action:'propose',invite,questionId:q,answer:'yes'},a.session,at(6));
 await runScheduler(at(8)); // still inside the 3-minute dispute window
 const d=await db();const state=async()=>(await d.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q])).rows[0].state;
 assert.equal(await state(),'proposed');
 await runScheduler(at(10)); // window closed: settles
 assert.equal(await state(),'settled');
 const ben=(await identity(b.session))!.id;
 assert.equal((await d.query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1 AND user_id=$2',[q,ben])).rows[0].points_tenths,150);
 await runScheduler(at(52)); // past publish: everything settled, so final
 const done=await view(invite,a.session,undefined,at(52));
 const round=done.rounds?.find(r=>r.id===v.selectedRound?.id);
 assert.equal(round?.state,'final');assert.equal(round?.winners[0].name,'Ben');
 await runScheduler(at(62)); // next round opens an hour after the first
 const next=await view(invite,a.session,undefined,at(62));
 assert.equal(next.rounds?.filter(r=>r.state==='live').length,1);assert.notEqual(next.currentRoundId,v.selectedRound?.id);
 // A normal group created at the same moment still waits for Monday.
 const n=await execute({action:'create',name:'Nia',groupName:'Normal crew',timezone:'Europe/Istanbul'},undefined,start);
 for(const name of ['Oz','Pia'])await execute({action:'join',invite:n.invite!,name},undefined,start);
 const nv=await view(n.invite!,n.session,undefined,at(1));
 assert.equal(nv.timing?.practice,false);assert.notEqual(nv.selectedRound?.state,'live');
 assert.equal(new Date((nv.group as {opens_at:Date}).opens_at).toISOString(),'2030-04-14T21:00:00.000Z','Monday 00:00 Istanbul');
});

test('practice disputes are judged on the fast clock and unresolved calls void after 10 minutes',async()=>{
 process.env.PRACTICE_GROUPS='1';
 const t0=new Date('2030-05-01T10:00:00Z'),m=(x:number)=>new Date(t0.getTime()+x*MIN);
 const a=await execute({action:'create',name:'Ada',groupName:'Fast',practice:true},undefined,t0),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Bo'},undefined,t0),c=await execute({action:'join',invite,name:'Cy'},undefined,t0);
 const q=(await execute({action:'question',invite,text:'Rain today?',locksAt:m(2).toISOString()},a.session,m(1))).questionId!;
 await execute({action:'predict',invite,questionId:q,answer:'yes',stake:10},b.session,m(1));
 const q2=(await execute({action:'question',invite,text:'Nobody resolves this?',locksAt:m(2).toISOString()},a.session,m(1))).questionId!;
 await runScheduler(m(3));
 await execute({action:'propose',invite,questionId:q,answer:'no'},a.session,m(3));
 await execute({action:'dispute',invite,questionId:q},b.session,m(4));
 await execute({action:'judge',invite,questionId:q,answer:'yes'},c.session,m(5));
 const d=await db();
 assert.equal((await d.query<{result_answer:string}>('SELECT result_answer FROM questions WHERE id=$1',[q])).rows[0].result_answer,'yes');
 // q2's event is the round deadline (+45 min); unresolved 10 minutes later it voids.
 await runScheduler(m(54));assert.equal((await d.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q2])).rows[0].state,'open');
 await runScheduler(m(56));assert.equal((await d.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q2])).rows[0].state,'void');
});
