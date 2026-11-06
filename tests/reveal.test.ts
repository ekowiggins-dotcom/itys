import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'reveal-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,identity,view}=await import('../lib/service');
const {shareArt}=await import('../lib/share-data');const {revealHeadline}=await import('../lib/reveal');const {artText}=await import('../lib/share-response');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

test('the reveal line: how many said whom, ties, and you',()=>{
 assert.equal(revealHeadline([{name:'Can',count:4},{name:'Ege',count:1}],5,'en'),'4 of 5 said Can');
 assert.equal(revealHeadline([{name:'Can',count:4},{name:'Ege',count:1}],5,'tr'),'5 kişiden 4 kişi Can dedi');
 assert.equal(revealHeadline([{name:'Can',count:2},{name:'Ege',count:2}],4,'en'),'Can and Ege, tied');
 assert.equal(revealHeadline([{name:'Arda',count:3}],4,'en','arda'),'3 of 4 said you');
 assert.equal(revealHeadline([{name:'Arda',count:3}],4,'tr','Arda'),'4 kişiden 3 kişi seni dedi');
});

async function crew(){
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',friends:['Ege','Can'],lang:'en',startNow:true});
 const e=await execute({action:'join',invite:a.invite!,name:'Ege'}),c=await execute({action:'join',invite:a.invite!,name:'Can'});
 return {invite:a.invite!,s:[a.session!,e.session!,c.session!]};
}
// Picks close the normal way: the next look at the group after the lock time.
const later=new Date(Date.now()+2*3600000);
async function lockNow(f:{invite:string;s:string[]}){await view(f.invite,f.s[0],undefined,later)}

test('the reveal card waits for picks to close, then shows counts only',async()=>{
 const f=await crew();const locks=new Date(Date.now()+3600000).toISOString();
 const q=(await execute({action:'question',invite:f.invite,text:'Who bails first?',answerType:'friend',locksAt:locks},f.s[0])).questionId!;
 await execute({action:'predict',invite:f.invite,questionId:q,answer:'Can'},f.s[0]);await execute({action:'predict',invite:f.invite,questionId:q,answer:'Can'},f.s[1]);await execute({action:'predict',invite:f.invite,questionId:q,answer:'Ege'},f.s[2]);
 const before=await shareArt(f.invite,{questionId:q,reveal:true});assert.equal(before?.variant,'friend','still open: the normal card, no answers');
 await lockNow(f);
 const art=await shareArt(f.invite,{questionId:q,reveal:true},later);assert.equal(art?.variant,'reveal');
 assert.deepEqual(art?.variant==='reveal'&&art.rows,[{name:'Can',count:2},{name:'Ege',count:1}]);
 assert.ok(art?.variant==='reveal'&&!('pickers' in art)&&!JSON.stringify(art.rows).includes('Arda'),'counts per friend only, never who said what');
 assert.equal(artText(art!).title,'2 of 3 said Can 👀');
});

test('a call about someone keeps its reveal closed until it settles',async()=>{
 const f=await crew();const ege=(await identity(f.s[1]))!.id;const locks=new Date(Date.now()+3600000).toISOString();
 const q=(await execute({action:'question',invite:f.invite,text:'Who will Ege text first?',answerType:'friend',locksAt:locks,subjectId:ege},f.s[0])).questionId!;
 await execute({action:'predict',invite:f.invite,questionId:q,answer:'Can'},f.s[0]);await execute({action:'predict',invite:f.invite,questionId:q,answer:'Arda'},f.s[2]);
 await lockNow(f);
 assert.equal(await shareArt(f.invite,{questionId:q,reveal:true},later),null);
});
