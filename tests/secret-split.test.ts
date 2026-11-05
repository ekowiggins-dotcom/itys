import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,view} from '../lib/service';import {runScheduler} from '../lib/scheduler';import {lifecycle} from '../lib/lifecycle';import {publicShare} from '../lib/share-data';
const folder=await mkdtemp(join(tmpdir(),'secret-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
type V={bets:{id:string;split?:Record<string,number>;answer:string|null}[];questions:{id:string}[];secretCount:number;notifications:{kind:string;text:string}[]};

test('a call about you: you see it, but not how anyone answered until it settles',async()=>{
 const base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');
 const a=await execute({action:'create',name:'Arda',groupName:'Crew'},undefined,base),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Can'},undefined,base),c=await execute({action:'join',invite,name:'Ege'},undefined,base);
 await runScheduler(monday);
 const canId=(await view(invite,b.session,undefined,monday)).user!.id;
 const q=(await execute({action:'question',invite,text:'Will Can bring up crypto?',locksAt:new Date(monday.getTime()+3600000).toISOString(),subjectId:canId},a.session,monday)).questionId!;
 const asCan=await view(invite,b.session,undefined,monday) as unknown as V;
 const mine=asCan.bets.find(x=>x.id===q) as unknown as {text:string;about_you?:boolean};assert.equal(mine?.text,'Will Can bring up crypto?','Can sees the call');assert.equal(mine.about_you,true);
 assert.ok(asCan.notifications.some(n=>n.kind==='about_you'),'and gets a heads-up');
 await assert.rejects(execute({action:'predict',invite,questionId:q,answer:'no',stake:10},b.session,monday),/tagged person/);
 const share=await publicShare(invite,{questionId:q},monday);assert.ok(!JSON.stringify(share.card).includes('crypto'),'link preview keeps it secret');
 // The others see it, and see the split only once they've picked.
 const before=await view(invite,c.session,undefined,monday) as unknown as V;assert.equal(before.bets.find(x=>x.id===q)!.split,undefined);
 await execute({action:'predict',invite,questionId:q,answer:'yes',stake:20},a.session,monday);await execute({action:'predict',invite,questionId:q,answer:'yes',stake:10},c.session,monday);
 const after1=await view(invite,c.session,undefined,monday) as unknown as V;assert.deepEqual(after1.bets.find(x=>x.id===q)!.split,{yes:2});
 const canMid=await view(invite,b.session,undefined,new Date(monday.getTime()+90*60000)) as unknown as V&{snapshots:{question_id:string}[]};
 assert.equal(canMid.bets.find(x=>x.id===q)!.split,undefined,'no split for Can, even after it locks');assert.ok(!canMid.snapshots.some(s=>s.question_id===q),'no who-said-what for Can');
 // Result: Can finally sees it.
 const later=new Date(monday.getTime()+2*3600000);await lifecycle({action:'propose',invite,questionId:q,answer:'yes'},(await view(invite,a.session,undefined,later)).user!.id!,later);
 const canProposed=await view(invite,b.session,undefined,new Date(later.getTime()+60000)) as unknown as V;assert.equal((canProposed.bets.find(x=>x.id===q) as unknown as {proposed_answer:string|null}).proposed_answer,null,'not the result either, until it counts');
 const settled=new Date(later.getTime()+2*86400000);await runScheduler(settled);
 const asCanAfter=await view(invite,b.session,undefined,settled) as unknown as V;
 assert.ok(asCanAfter.bets.some(x=>x.id===q),'visible once settled');assert.equal(asCanAfter.secretCount,0);
 assert.ok(asCanAfter.notifications.some(n=>n.text.startsWith('The secret call about you: “Will Can bring up crypto?” · it was Yes')));
});
