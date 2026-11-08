import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'reminders-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,view}=await import('../lib/service');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

test('new-style groups: an hour before a call locks, friends who haven’t picked get nudged once',async()=>{
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',startNow:true});
 const b=await execute({action:'join',invite:a.invite,name:'Ege'});
 const c=await execute({action:'join',invite:a.invite,name:'Can'});
 const now=Date.now(),locks=new Date(now+3*3600000);
 const q=await execute({action:'question',invite:a.invite,text:'Does Can turn up on time?',locksAt:locks.toISOString()},a.session) as {questionId:string};
 await execute({action:'predict',invite:a.invite,questionId:q.questionId,answer:'yes'},a.session);
 const nudges=async(s:string,at:number)=>((await view(a.invite!,s,undefined,new Date(at))) as {notifications?:{kind:string;text:string}[]}).notifications?.filter(n=>n.kind==='lock_reminder')||[];
 assert.equal((await nudges(b.session!,now)).length,0,'not yet: three hours to go');
 const soon=locks.getTime()-30*60000;
 const ege=await nudges(b.session!,soon);
 assert.equal(ege.length,1);assert.match(ege[0].text,/Arda made a call on Does Can turn up on time\?/);
 assert.equal((await nudges(b.session!,soon+60000)).length,1,'once, not every visit');
 assert.equal((await nudges(a.session!,soon)).length,0,'Arda already picked');
 assert.equal((await nudges(c.session!,soon)).length,1,'Can hasn’t picked either');
});

test('metrics: active groups, calls, picks, pick rate and unsettled calls, practice groups left out',async()=>{
 const {metrics}=await import('../lib/metrics');
 const g=await execute({action:'create',name:'Deniz',groupName:'Book club',startNow:true});
 const e=await execute({action:'join',invite:g.invite,name:'Ece'});
 await execute({action:'create',name:'Test',groupName:'Practice',startNow:true,practice:true}).catch(()=>{});
 const q=await execute({action:'question',invite:g.invite,text:'Does Ece finish the book?',locksAt:new Date(Date.now()+2*3600000).toISOString()},g.session) as {questionId:string};
 await execute({action:'predict',invite:g.invite,questionId:q.questionId,answer:'no'},e.session);
 const m=await metrics(new Date(Date.now()+60000));
 const row=m.groups.find(x=>x.name==='Book club')!;
 assert.equal(row.members,2);assert.equal(row.calls7,1);assert.equal(row.picks7,1);assert.equal(row.callers7,1);
 assert.ok(!m.groups.some(x=>x.name==='Practice'));
 assert.ok(m.totals.activeThisWeek>=1);
 const week=m.weeks.at(-1)!;assert.ok(week.calls>=1&&week.picks>=1);
 // Two days after it locked and nobody settled it: it shows up as unsettled.
 const later=await metrics(new Date(Date.now()+2*3600000+2*86400000));
 assert.equal(later.groups.find(x=>x.name==='Book club')!.unsettled,1);
 assert.equal(JSON.stringify(later).includes('Does Ece finish'),false,'no call text or answers on the page');
});
