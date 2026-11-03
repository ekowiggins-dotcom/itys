import {test,after} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,view,identity} from '../lib/service';import {runScheduler} from '../lib/scheduler';import {dropCount,seasonTotals,type SeasonRoundInput} from '../lib/season-rules';
const folder=await mkdtemp(join(tmpdir(),'season-tests-'));process.env.PREDICTION_DATA_DIR=folder;after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
const DAY=86400000,mon=new Date('2030-04-08T00:00:00Z'),base=new Date('2030-04-07T12:00:00Z');const at=(days:number,h=0)=>new Date(mon.getTime()+days*DAY+h*3600000);
async function fixture(){const a=await execute({action:'create',name:'Alex',groupName:'Season crew'},undefined,base),invite=a.invite!;const b=await execute({action:'join',invite,name:'Maya'},undefined,base),c=await execute({action:'join',invite,name:'Sam'},undefined,base);const tokens=[a.session!,b.session!,c.session!],ids=await Promise.all(tokens.map(async t=>(await identity(t))!.id));await runScheduler(mon);return{invite,tokens,ids};}
test('scaled drops exclude skipped/uneligible/pending rounds, prioritize missed zeroes and round only after adding',()=>{
 assert.deepEqual([0,1,3,4,7,8,20].map(dropCount),[0,0,0,1,1,2,2]);
 const rows:SeasonRoundInput[]=Array.from({length:8},(_,i)=>({id:'r'+i,opens_at:at(i*7).toISOString(),state:'final',eligible:true,missed:i===1,raw_score:i<2?'0':'8.333333333333'}));
 const p=seasonTotals(rows,[]);assert.equal(p.dropCount,2);assert.deepEqual(p.rounds.filter(r=>r.dropped).map(r=>r.id).sort(),['r0','r1']);assert.equal(p.totalTenths,500);
 const four=seasonTotals(rows.slice(0,4),[]);assert.deepEqual(four.rounds.filter(r=>r.dropped).map(r=>r.id),['r1']);
 const filtered=seasonTotals(rows.map((r,i)=>({...r,eligible:i<3,state:i===2?'skipped':'final'})),[]);assert.equal(filtered.completedEligible,2);assert.equal(filtered.dropCount,0);
 assert.equal(seasonTotals([{...rows[0],raw_score:'8.333333333333'},{...rows[1],raw_score:'8.333333333333'}],['0.05']).totalTenths,167);
});
test('eight weekly rounds show drops, one-time notices, provisional end and immutable frozen standings',async()=>{
 const f=await fixture(),stakes=[5,10,15,20,25,30,5,10];const original=(await view(f.invite,f.tokens[0],undefined,mon)).seasons![0].id;
 for(let i=0;i<8;i++){
 const created=at(7*i,13),lock=at(7*i,14),proposal=at(7*i,15);
 const q=(await execute({action:'question',invite:f.invite,text:'Will week '+(i+1)+' work?',locksAt:lock.toISOString()},f.tokens[0],created)).questionId!;
 await execute({action:'predict',invite:f.invite,questionId:q,answer:'yes',stake:stakes[i]},f.tokens[0],created);await execute({action:'predict',invite:f.invite,questionId:q,answer:'no',stake:10},f.tokens[1],created);
 await execute({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.tokens[0],proposal);
 await runScheduler(at(7*i+1,15));
 if(i===7){await execute({action:'season',invite:f.invite,name:'Season two',startsAt:at(56).toISOString(),endsAt:at(112).toISOString()},f.tokens[0],at(50,16));await runScheduler(at(56));const both=(await view(f.invite,f.tokens[0],undefined,at(56))).seasons!;assert.equal(both.find(s=>s.id===original)!.state,'provisional');assert.ok(both.some(s=>s.name==='Season two'&&s.state==='active'));}
 await runScheduler(at(7*(i+1),12));
 if(i===3){const s=(await view(f.invite,f.tokens[0],undefined,at(28,12))).seasons!.find(s=>s.id===original)!;assert.equal(s.myStanding!.dropCount,1);assert.equal(s.myStanding!.totalTenths,675);assert.equal(s.dropNotices.length,1);const id=s.dropNotices[0].id;await execute({action:'seasonNoticeRead',invite:f.invite,noticeId:id},f.tokens[0],at(28,12));assert.equal((await view(f.invite,f.tokens[0],undefined,at(28,12))).seasons!.find(s=>s.id===original)!.dropNotices.length,0);}
 }
 const frozen=(await view(f.invite,f.tokens[0],undefined,at(56,12))).seasons!.find(s=>s.id===original)!;assert.equal(frozen.state,'frozen');assert.equal(frozen.myStanding!.dropCount,2);assert.equal(frozen.myStanding!.totalTenths,1650);assert.equal(frozen.myStanding!.rounds.filter(r=>r.dropped).length,2);assert.equal(frozen.dropNotices.length,1);
 const d=await db(),snapshot=(await d.query<{snapshot:unknown}>('SELECT snapshot FROM seasons WHERE id=$1',[original])).rows[0].snapshot;
 await assert.rejects(d.query("UPDATE seasons SET name='Edited' WHERE id=$1",[original]),/read-only/);await assert.rejects(d.query('UPDATE scores SET points_value=0 WHERE season_id=$1',[original]),/read-only/);
 await execute({action:'leave',invite:f.invite},f.tokens[1],at(57));await execute({action:'join',invite:f.invite},f.tokens[1],at(58));await runScheduler(at(59));assert.deepEqual((await d.query<{snapshot:unknown}>('SELECT snapshot FROM seasons WHERE id=$1',[original])).rows[0].snapshot,snapshot);
});
test('leaving/rejoining restores season history and does not create absent-week or pre-join eligibility',async()=>{
 const f=await fixture();const q=(await execute({action:'question',invite:f.invite,text:'Our first week?',locksAt:at(0,2).toISOString()},f.tokens[0],mon)).questionId!;await execute({action:'predict',invite:f.invite,questionId:q,answer:'yes',stake:20},f.tokens[1],mon);await execute({action:'leave',invite:f.invite},f.tokens[1],at(0,3));await execute({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.tokens[0],at(0,4));await runScheduler(at(8));
 let owner=await view(f.invite,f.tokens[0],undefined,at(8));assert.ok(!owner.seasons![0].standings.some(s=>s.user_id===f.ids[1]));await execute({action:'join',invite:f.invite},f.tokens[1],at(10));const restored=await view(f.invite,f.tokens[1],undefined,at(10));const mine=restored.seasons![0].myStanding!;assert.equal(mine.totalTenths,200);assert.equal(mine.rounds.filter(r=>r.eligible).length,1);
 const late=await execute({action:'join',invite:f.invite,name:'Late friend'},undefined,at(10));const data=await view(f.invite,late.session,undefined,at(10));assert.equal(data.seasons![0].myStanding!.totalTenths,0);assert.ok(data.seasons![0].myStanding!.rounds.every(r=>!r.eligible));
});
test('long-term stakes are separate, limit is atomic and per group; create alone does not count',async()=>{
 const f=await fixture();const qs:string[]=[];for(let i=0;i<4;i++)qs.push((await execute({action:'longterm',invite:f.invite,text:'Will plan '+i+' happen next month?',locksAt:at(1).toISOString(),eventAt:at(30).toISOString()},f.tokens[0],mon)).questionId!);
 assert.equal((await view(f.invite,f.tokens[0],undefined,mon)).longTermCount,0);
 for(let i=0;i<2;i++)await execute({action:'predictLongterm',invite:f.invite,questionId:qs[i],answer:'yes'},f.tokens[1],mon);
 const last=await Promise.allSettled(qs.slice(2).map(questionId=>execute({action:'predictLongterm',invite:f.invite,questionId,answer:'yes'},f.tokens[1],mon)));assert.equal(last.filter(r=>r.status==='fulfilled').length,1);let data=await view(f.invite,f.tokens[1],undefined,mon);assert.equal(data.longTermCount,3);assert.equal(data.used,0);
 await execute({action:'predictLongterm',invite:f.invite,questionId:qs[0],answer:'no'},f.tokens[1],mon);assert.equal((await view(f.invite,f.tokens[1],undefined,mon)).longTermCount,3);
 await assert.rejects(execute({action:'longterm',invite:f.invite,text:'Too short?',locksAt:at(1).toISOString(),eventAt:at(2).toISOString()},f.tokens[0],mon),/weekly call/);
 const other=await fixture();await execute({action:'join',invite:other.invite},f.tokens[1],mon);const q=(await execute({action:'longterm',invite:other.invite,text:'Another group?',locksAt:at(1).toISOString(),eventAt:at(30).toISOString()},other.tokens[0],mon)).questionId!;await execute({action:'predictLongterm',invite:other.invite,questionId:q,answer:'yes'},f.tokens[1],mon);
});
test('open long-term bets do not prevent freezing and add points only to the settlement season',async()=>{
 const f=await fixture(),d=await db();const s=(await view(f.invite,f.tokens[0],undefined,mon)).seasons![0].id;
 // Shorten this test-only published fixture before any freeze, then schedule the next fixed window.
 await d.query('UPDATE seasons SET ends_at=$1 WHERE id=$2',[at(7),s]);await execute({action:'season',invite:f.invite,name:'Next',startsAt:at(7).toISOString(),endsAt:at(21).toISOString()},f.tokens[0],mon);
 const q=(await execute({action:'longterm',invite:f.invite,text:'Will we finish in two weeks?',locksAt:at(1).toISOString(),eventAt:at(14).toISOString()},f.tokens[0],mon)).questionId!;await execute({action:'predictLongterm',invite:f.invite,questionId:q,answer:'yes'},f.tokens[1],mon);await runScheduler(at(7,12));
 const frozen=(await view(f.invite,f.tokens[1],undefined,at(7,12))).seasons!.find(x=>x.id===s)!;assert.equal(frozen.state,'frozen');assert.equal(frozen.myStanding!.longTermTenths,0);
 await execute({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.tokens[0],at(14));await runScheduler(at(15));const state=await view(f.invite,f.tokens[1],undefined,at(15));assert.equal(state.seasons!.find(x=>x.id===s)!.myStanding!.longTermTenths,0);assert.equal(state.seasons!.find(x=>x.name==='Next')!.myStanding!.longTermTenths,200);
});
test('long-term tagged subjects cannot participate and deadline void returns ten season points',async()=>{
 const f=await fixture();const tagged=(await execute({action:'longterm',invite:f.invite,text:'Will Maya finish the challenge?',locksAt:at(1).toISOString(),eventAt:at(14).toISOString(),subjectId:f.ids[1]},f.tokens[0],mon)).questionId!;await assert.rejects(execute({action:'predictLongterm',invite:f.invite,questionId:tagged,answer:'yes'},f.tokens[1],mon),/tagged person/);
 await execute({action:'predictLongterm',invite:f.invite,questionId:tagged,answer:'yes'},f.tokens[0],mon);const d=await db();assert.equal((await d.query<{stake:number}>('SELECT stake FROM predictions WHERE question_id=$1',[tagged])).rows[0].stake,10);await runScheduler(at(21));const data=await view(f.invite,f.tokens[0],undefined,at(21));assert.equal(data.longTermCount,0);assert.equal(data.seasons![0].myStanding!.longTermTenths,100);assert.equal((await d.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[tagged])).rows[0].state,'void');
});
test('activation respects a season published before the third member joins',async()=>{
 const owner=await execute({action:'create',name:'Early admin',groupName:'Custom season first'},undefined,base),invite=owner.invite!;await execute({action:'season',invite,name:'Custom dates',startsAt:mon.toISOString(),endsAt:at(28).toISOString()},owner.session,base);await execute({action:'join',invite,name:'Second'},undefined,base);await execute({action:'join',invite,name:'Third'},undefined,base);const data=await view(invite,owner.session,undefined,mon);assert.equal(data.seasons!.length,1);assert.equal(data.seasons![0].name,'Custom dates');
});
