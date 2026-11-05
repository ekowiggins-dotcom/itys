import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'setup-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,view,betPreview}=await import('../lib/service');const {shareArt}=await import('../lib/share-data');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});
const soon=()=>new Date(Date.now()+3*3600000).toISOString();

test('a new group starts now: the creator adds friends by name and makes the first friend call alone',async()=>{
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',friends:['Ege','Can','Deniz','ege','Arda'],color:'#FF8A5B',lang:'tr',startNow:true});const invite=a.invite!;
 const v0=await view(invite,a.session) as unknown as {selectedRound?:{state:string};group:{pending_names:string[];color:string;lang:string}};
 assert.equal(v0.selectedRound?.state,'live','no waiting for three members');
 assert.deepEqual(v0.group.pending_names,['Ege','Can','Deniz'],'duplicates and your own name are dropped');
 const q=(await execute({action:'question',invite,text:'Akşamı kim eker?',answerType:'friend',locksAt:soon()},a.session)).questionId!;
 const v=await view(invite,a.session);const call=(v.bets as {id:string;options:string[];answer_type:string}[]).find(b=>b.id===q)!;
 assert.equal(call.answer_type,'friend');assert.deepEqual(call.options,['Arda','Ege','Can','Deniz']);
 await execute({action:'predict',invite,questionId:q,answer:'Ege'},a.session);
 await assert.rejects(execute({action:'predict',invite,questionId:q,answer:'Mehmet'},a.session),/valid answer|answer/i);

 // Ege gets the link: he sees he was picked, claims his name, and it leaves the waiting list.
 const preview=await betPreview(invite,q) as {pickedYou?:Record<string,number>};assert.deepEqual(preview.pickedYou,{Ege:1});
 const pv=await view(invite) as unknown as {pendingNames:string[]};assert.deepEqual(pv.pendingNames,['Ege','Can','Deniz']);
 const ege=await execute({action:'join',invite,name:'Ege'});
 const after=await view(invite,ege.session) as unknown as {group:{pending_names:string[]}};assert.deepEqual(after.group.pending_names,['Can','Deniz']);
 await execute({action:'predict',invite,questionId:q,answer:'Deniz'},ege.session);

 // Cards: the friend card lists who's in (names, not picks); "for Deniz" tells Deniz he was picked; the language is the group's.
 const card=await shareArt(invite,{questionId:q});assert.equal(card?.variant,'friend');
 if(card?.variant==='friend'){assert.deepEqual(card.pickers,['Arda','Ege']);assert.equal(card.lang,'tr');assert.equal(card.group.color,'#FF8A5B');}
 const picked=await shareArt(invite,{questionId:q,forName:'Deniz'});assert.equal(picked?.variant,'picked');if(picked?.variant==='picked')assert.equal(picked.count,1);
 assert.equal((await shareArt(invite,{questionId:q,forName:'Can'}))?.variant,'friend','nobody picked Can yet: no "you were picked" card');
 assert.equal((await shareArt(invite,{}))?.variant,'invite');
});

test('older groups keep waiting for three members, and a friend call needs at least two names',async()=>{
 const a=await execute({action:'create',name:'Selin',groupName:'Old style'});
 assert.equal((await view(a.invite!,a.session)).selectedRound,undefined);
 const b=await execute({action:'create',name:'Mert',groupName:'Alone',startNow:true});
 await assert.rejects(execute({action:'question',invite:b.invite,text:'Who wins?',answerType:'friend',locksAt:soon()},b.session),/Add at least one friend/);
});

test('anyone in the group can add friends who aren’t in yet, without duplicates',async()=>{
 const {lifecycle}=await import('../lib/lifecycle');const {identity}=await import('../lib/service');
 const a=await execute({action:'create',name:'Can',groupName:'Flat',friends:['Ece'],startNow:true});const me=(await identity(a.session))!.id;
 await lifecycle({action:'addNames',invite:a.invite,names:['Bora','ece','Can','Bora']},me);
 assert.deepEqual(((await view(a.invite!,a.session)) as unknown as {group:{pending_names:string[]}}).group.pending_names,['Ece','Bora']);
 await assert.rejects(lifecycle({action:'addNames',invite:a.invite,names:['Ece']},me),/already in the group/);
});
