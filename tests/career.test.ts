import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,view} from '../lib/service';import {runScheduler} from '../lib/scheduler';import {lifecycle} from '../lib/lifecycle';
import {levelFor,LEVELS,type Career} from '../lib/career';
const folder=await mkdtemp(join(tmpdir(),'career-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});

test('levels: ten of them, with progress to the next',()=>{
 assert.equal(LEVELS.length,10);
 assert.deepEqual([0,49,50,1240,3600,9999].map(p=>levelFor(p).name),['Guesser','Guesser','Hunch Hunter','Oracle','The All-Seeing','The All-Seeing']);
 const o=levelFor(1240);assert.equal(o.n,7);assert.equal(o.next?.name,'Time Traveller');assert.equal(o.next?.toGo,560);assert.ok(Math.abs(o.progress-40/600)<1e-9);
 assert.equal(levelFor(3600).next,null);
});

test('career points add up what you won, only go up, and earn badges',async()=>{
 const base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');
 const a=await execute({action:'create',name:'Arda',groupName:'Crew'},undefined,base),invite=a.invite!;
 const others=[];for(const n of ['Ege','Can','Deniz'])others.push(await execute({action:'join',invite,name:n},undefined,base));
 await runScheduler(monday);const admin=(await view(invite,a.session,undefined,monday)).user!.id!;
 // Three calls; Arda alone right on all three.
 for(let i=0;i<3;i++){
  const t=new Date(monday.getTime()+i*60000);
  const q=(await execute({action:'question',invite,text:'Call number '+(i+1)+'?',locksAt:new Date(monday.getTime()+3600000).toISOString()},a.session,t)).questionId!;
  await execute({action:'predict',invite,questionId:q,answer:'yes',stake:30},a.session,t);
  for(const o of others)await execute({action:'predict',invite,questionId:q,answer:'no',stake:10},o.session,new Date(t.getTime()+1000));
  const later=new Date(monday.getTime()+2*3600000+i*60000);await lifecycle({action:'propose',invite,questionId:q,answer:'yes'},admin,later);
 }
 const settled=new Date(monday.getTime()+3*86400000);await runScheduler(settled);
 const v=await view(invite,a.session,undefined,settled) as unknown as {careers:Career[]};
 const arda=v.careers.find(c=>c.user_id===admin)!;
 assert.equal(arda.points,3*33,'alone in 4: 33 per call');assert.equal(arda.level.name,'Hunch Hunter');
 for(const b of ['lone_wolf','hat_trick'])assert.ok(arda.badges[b],b);
 // Houdini needs fewer than a quarter agreeing (alone in 4 is exactly a quarter); counters need their target first.
 for(const b of ['houdini','crowd','early_bird'])assert.equal(arda.badges[b],undefined,b);
 assert.equal(arda.badges.lone_wolf,3);assert.equal(arda.badges.rock_solid,undefined,'Spot On is only for exact scores');
 const ege=v.careers.find(c=>c.user_id!==admin)!;assert.equal(ege.points,0);assert.equal(ege.level.name,'Guesser');assert.equal(ege.earned,0);
});
