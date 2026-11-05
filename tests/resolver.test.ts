import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'resolver-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,identity}=await import('../lib/service');const {lifecycle}=await import('../lib/lifecycle');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

async function crew(){
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',friends:['Ege','Can'],lang:'tr',startNow:true});
 const e=await execute({action:'join',invite:a.invite!,name:'Ege'}),c=await execute({action:'join',invite:a.invite!,name:'Can'});
 const [arda,ege,can]=await Promise.all([a,e,c].map(async x=>(await identity(x.session))!.id));
 return {invite:a.invite!,s:{arda:a.session!,ege:e.session!,can:c.session!},id:{arda,ege,can}};
}
const soon=()=>new Date(Date.now()+60000).toISOString(),later=()=>new Date(Date.now()+120000);
const resolverOf=async(q:string)=>(await (await db()).query<{resolver_id:string|null}>('SELECT resolver_id FROM questions WHERE id=$1',[q])).rows[0].resolver_id;

test('the admin says what happened by default, even on someone else’s call',async()=>{
 const g=await crew();const q=(await execute({action:'question',invite:g.invite,text:'Can gelir mi?',locksAt:soon()},g.s.ege)).questionId!;
 await assert.rejects(lifecycle({action:'propose',invite:g.invite,questionId:q,answer:'yes'},g.id.ege,later()),/Only the person settling/);
 await lifecycle({action:'propose',invite:g.invite,questionId:q,answer:'yes'},g.id.arda,later());
});

test('the admin can hand a call to someone else; only the admin can change it',async()=>{
 const g=await crew();const q=(await execute({action:'question',invite:g.invite,text:'Ege geç kalır mı?',locksAt:soon()},g.s.arda)).questionId!;
 await assert.rejects(lifecycle({action:'setResolver',invite:g.invite,questionId:q,targetId:g.id.can},g.id.ege),/Only the admin/);
 await lifecycle({action:'setResolver',invite:g.invite,questionId:q,targetId:g.id.can},g.id.arda);assert.equal(await resolverOf(q),g.id.can);
 const told=(await (await db()).query("SELECT 1 FROM notifications WHERE user_id=$1 AND kind='judgment_request'",[g.id.can])).rows.length;assert.equal(told,1,'Can is told');
 await assert.rejects(lifecycle({action:'propose',invite:g.invite,questionId:q,answer:'no'},g.id.arda,later()),/Only the person settling/);
 await lifecycle({action:'propose',invite:g.invite,questionId:q,answer:'no'},g.id.can,later());
 await assert.rejects(lifecycle({action:'setResolver',invite:g.invite,questionId:q,targetId:g.id.ege},g.id.arda),/already has a result/);
});

test('picking the settler when making a call works for the admin only',async()=>{
 const g=await crew();
 const mine=(await execute({action:'question',invite:g.invite,text:'Halı sahada en çok golü kim atar?',locksAt:soon(),resolverId:g.id.ege},g.s.arda)).questionId!;
 assert.equal(await resolverOf(mine),g.id.ege);
 const theirs=(await execute({action:'question',invite:g.invite,text:'Akşamı kim eker?',locksAt:soon(),resolverId:g.id.can},g.s.ege)).questionId!;
 assert.equal(await resolverOf(theirs),null,'a non-admin can’t pick; it stays with the admin');
});
