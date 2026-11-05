import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
const dir=await mkdtemp(join(tmpdir(),'rankings-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,identity,view}=await import('../lib/service');
const {weekStart,monthStart,timeBoards,announceOracle}=await import('../lib/rankings');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});
const Z='Europe/Istanbul';

test('week and month start at local midnight (Monday, the 1st)',()=>{
 const now=new Date('2026-11-05T13:00:00Z');
 assert.equal(weekStart(now,Z).toISOString(),'2026-11-01T21:00:00.000Z');
 assert.equal(monthStart(now,Z).toISOString(),'2026-10-31T21:00:00.000Z');
 assert.equal(monthStart(now,Z,1).toISOString(),'2026-09-30T21:00:00.000Z');
 assert.equal(monthStart(new Date('2026-01-10T10:00:00Z'),Z,1).toISOString(),'2025-11-30T21:00:00.000Z');
});

async function crew(){
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',friends:['Ege','Can'],lang:'tr',startNow:true});
 const e=await execute({action:'join',invite:a.invite!,name:'Ege'}),c=await execute({action:'join',invite:a.invite!,name:'Can'});
 const [arda,ege,can]=await Promise.all([a,e,c].map(async x=>(await identity(x.session))!.id));
 const g=(await (await db()).query<{id:string}>('SELECT id FROM groups WHERE invite=$1',[a.invite])).rows[0].id;
 return {g,invite:a.invite!,session:a.session!,id:{arda,ege,can}};
}
async function score(g:string,creator:string,user:string,points:number,at:string){
 const d=await db(),q=randomUUID();
 await d.query("INSERT INTO questions(id,group_id,creator,text,locks_at,scope,state) VALUES($1,$2,$3,'?',$4,'longterm','settled')",[q,g,creator,at]);
 await d.query("INSERT INTO scores(question_id,user_id,points_tenths,settled_at,allocation,points_value,exact_correct) VALUES($1,$2,$3,$4,'credited',$5,0)",[q,user,points*10,at,String(points)]);
}

test('one table over time: points count on the day they settle; the top of last month is its Oracle, ties share it',async()=>{
 const f=await crew(),now=new Date('2026-11-05T13:00:00Z');
 await score(f.g,f.id.arda,f.id.ege,30,'2026-10-10T12:00:00Z');await score(f.g,f.id.arda,f.id.can,30,'2026-10-20T12:00:00Z');await score(f.g,f.id.arda,f.id.arda,12,'2026-10-25T12:00:00Z');
 await score(f.g,f.id.arda,f.id.arda,40,'2026-11-01T12:00:00Z'); // Sunday 1 Nov: this month, last week
 await score(f.g,f.id.arda,f.id.ege,10,'2026-11-03T12:00:00Z');
 const b=await (await db()).transaction(tx=>timeBoards(tx,f.g,Z,now));
 const pts=(rows:{user_id:string;points_tenths:number}[],u:string)=>rows.find(r=>r.user_id===u)!.points_tenths/10;
 assert.equal(pts(b.week,f.id.ege),10);assert.equal(pts(b.week,f.id.arda),0);
 assert.equal(pts(b.month,f.id.arda),40);assert.equal(b.month[0].user_id,f.id.arda);
 assert.equal(b.oracles[0].month,'2026-10');assert.deepEqual(b.oracles[0].winners.map(w=>w.name).sort(),['Can','Ege']);
 assert.equal(b.titles[f.id.ege],1);assert.equal(b.titles[f.id.arda],undefined);
 // Everyone hears once who called October best.
 for(let i=0;i<2;i++)await (await db()).transaction(tx=>announceOracle(tx,{id:f.g,timezone:Z},now));
 const sent=(await (await db()).query<{text:string}>("SELECT text FROM notifications WHERE group_id=$1 AND kind='month_final'",[f.g])).rows;
 assert.equal(sent.length,3);assert.match(sent[0].text,/are October’s Oracles with 30 points/);
});

test('groups made with the new setup get no weekly notifications',async()=>{
 const f=await crew();const v=await view(f.invite,f.session);
 assert.ok('boards' in v,'the view carries the tables');
 const weekly=(await (await db()).query("SELECT 1 FROM notifications WHERE group_id=$1 AND kind IN ('round_open','weekly_final')",[f.g])).rows.length;assert.equal(weekly,0);
});
