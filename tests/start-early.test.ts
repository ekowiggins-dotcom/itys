import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,view} from '../lib/service';import {runScheduler} from '../lib/scheduler';
const folder=await mkdtemp(join(tmpdir(),'start-early-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});

test('the admin can start a new group’s first week early; the normal Monday rhythm follows',async()=>{
 const wed=new Date('2030-04-10T11:00:00Z');
 const a=await execute({action:'create',name:'Arda',groupName:'Impatient',timezone:'Europe/Istanbul'},undefined,wed),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Ege'},undefined,wed);await execute({action:'join',invite,name:'Can'},undefined,wed);
 const before=await view(invite,a.session,undefined,wed);assert.ok(new Date((before.group as {opens_at:Date}).opens_at)>wed,'normally waits for Monday');
 await assert.rejects(execute({action:'startFirstWeek',invite},b.session,wed),/Only the admin/);
 await execute({action:'startFirstWeek',invite},a.session,wed);
 const v=await view(invite,a.session,undefined,wed);assert.equal(v.selectedRound?.state,'live');
 assert.equal(new Date(v.selectedRound!.deadline_at).toISOString(),'2030-04-14T20:59:00.000Z','ends Sunday 23:59 like any week');
 const q=await execute({action:'question',invite,text:'Will anyone be late tonight?',locksAt:new Date(wed.getTime()+3600000).toISOString()},b.session,wed);assert.ok(q.questionId,'calls work straight away');
 await assert.rejects(execute({action:'startFirstWeek',invite},a.session,wed),/already started/);
 const monday=new Date('2030-04-14T21:00:00Z');await runScheduler(monday);
 const next=await view(invite,a.session,undefined,monday);assert.equal(new Date(next.selectedRound!.opens_at).toISOString(),monday.toISOString(),'next week opens Monday 00:00');
});
