import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,betPreview} from '../lib/service';import {runScheduler} from '../lib/scheduler';
import {when,countdown,answerLabel} from '../app/format';
const folder=await mkdtemp(join(tmpdir(),'app-shell-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});

test('friendly times are relative to now and the group time zone',()=>{
 const now=Date.parse('2030-04-10T09:00:00Z'); // Wed 12:00 in Istanbul
 const z='Europe/Istanbul';
 assert.equal(when('2030-04-10T19:00:00Z',now,z),'Today 22:00');
 assert.equal(when('2030-04-11T09:00:00Z',now,z),'Tomorrow 12:00');
 assert.equal(when('2030-04-13T09:00:00Z',now,z),'Sat 12:00');
 assert.equal(when('2030-05-02T09:00:00Z',now,z),'2 May 12:00');
 assert.equal(when('2031-01-02T09:00:00Z',now,z),'2 Jan 2031 12:00');
 assert.equal(when(null,now),'');
 assert.equal(countdown(now+(2*24+4)*3600000+5*60000,now),'2d 4h');
 assert.equal(countdown(now+3*3600000+20*60000,now),'3h 20m');
 assert.equal(countdown(now-1,now),'now');
 assert.equal(answerLabel('yes'),'Yes');assert.equal(answerLabel('Mert'),'Mert');
});

test('an invite link previews only a visible custom bet in that group',async()=>{
 const base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');
 const a=await execute({action:'create',name:'A',groupName:'Preview crew'},undefined,base),invite=a.invite!;
 for(const n of ['B','C'])await execute({action:'join',invite,name:n},undefined,base);
 await runScheduler(monday);
 const q=(await execute({action:'question',invite,text:'Who is late?',locksAt:new Date(monday.getTime()+3600000).toISOString(),options:['B','C']},a.session,monday)).questionId!;
 const p=await betPreview(invite,q);
 assert.equal(p?.text,'Who is late?');assert.deepEqual(p?.options,['B','C']);assert.equal(p?.picked,0);
 const other=await execute({action:'create',name:'Z',groupName:'Other'},undefined,base);
 assert.equal(await betPreview(other.invite!,q),null,'not visible through another group’s invite');
 assert.equal(await betPreview(invite,'not-a-uuid'),null);
 await (await db()).query("UPDATE questions SET moderation_state='pending' WHERE id=$1",[q]);
 assert.equal(await betPreview(invite,q),null,'hidden bets are never previewed');
});
