import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';import {execute,identity,view} from '../lib/service';import {lifecycle,maintain} from '../lib/lifecycle';
const folder=await mkdtemp(join(tmpdir(),'lifecycle-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
const DAY=86400000;const now=new Date('2030-04-10T12:00:00Z');
async function fixture(){
 const a=await execute({action:'create',name:'Creator',groupName:'Rules group'}),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Player'}),c=await execute({action:'join',invite,name:'Judge'});
 const users=await Promise.all([a,b,c].map(x=>identity(x.session)));const d=await db();
 const g=(await d.query<{id:string}>('SELECT id FROM groups WHERE invite=$1',[invite])).rows[0].id;
 await d.query('UPDATE groups SET opens_at=$1,admin=$2 WHERE id=$3',[new Date(now.getTime()-3*DAY),users[2]!.id,g]);
 return {invite,g,ids:users.map(u=>u!.id),sessions:[a.session,b.session,c.session]};
}
async function question(g:string,creator:string,scope='weekly',event=new Date(now.getTime()-DAY)){
 const d=await db(),id=randomUUID();
 // The admin hands these calls to their creator to settle.
 await d.query('INSERT INTO questions(id,group_id,creator,text,locks_at,scope,event_at,resolver_id) VALUES($1,$2,$3,$4,$5,$6,$7,$3)',[id,g,creator,'Will it happen?',new Date(now.getTime()-2*DAY),scope,event]);return id;
}
async function pick(q:string,u:string,answer='yes',stake=20){await(await db()).query('INSERT INTO predictions(question_id,user_id,answer,stake) VALUES($1,$2,$3,$4)',[q,u,answer,stake]);}
test('leaving preserves locked weekly results and eligibility, withdraws unlocked bets, rejoin restores record',async()=>{
 const f=await fixture(),d=await db(),q=await question(f.g,f.ids[0]);await pick(q,f.ids[1]);
 const unlocked=await question(f.g,f.ids[0]);await d.query('UPDATE questions SET locks_at=$1 WHERE id=$2',[new Date(now.getTime()+DAY),unlocked]);await pick(unlocked,f.ids[1]);
 await lifecycle({action:'leave',invite:f.invite},f.ids[1],now);
 assert.equal((await d.query('SELECT * FROM predictions WHERE question_id=$1 AND user_id=$2',[unlocked,f.ids[1]])).rows.length,0);
 assert.equal((await d.query<{forfeited:boolean}>('SELECT forfeited FROM predictions WHERE question_id=$1',[q])).rows[0].forfeited,false);
 assert.equal((await d.query('SELECT 1 FROM round_eligibility WHERE group_id=$1 AND user_id=$2',[f.g,f.ids[1]])).rows.length,1);
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 await lifecycle({action:'tick',invite:f.invite},f.ids[0],new Date(now.getTime()+DAY));
 assert.equal((await d.query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1 AND user_id=$2',[q,f.ids[1]])).rows[0].points_tenths,100);
 await execute({action:'join',invite:f.invite},f.sessions[1]);
 assert.equal((await d.query('SELECT * FROM members WHERE group_id=$1 AND user_id=$2 AND active',[f.g,f.ids[1]])).rows.length,1);
 assert.equal((await d.query('SELECT 1 FROM scores WHERE question_id=$1 AND user_id=$2',[q,f.ids[1]])).rows.length,1);
});
test('resolution deadline cuts short disputes; failed late judgment cannot roll back automatic void',async()=>{
 const f=await fixture(),d=await db(),event=new Date(now.getTime()-7*DAY+3600000),q=await question(f.g,f.ids[0],'weekly',event);await pick(q,f.ids[1]);
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 await lifecycle({action:'dispute',invite:f.invite,questionId:q},f.ids[1],new Date(now.getTime()+1000));
 await assert.rejects(lifecycle({action:'judge',invite:f.invite,questionId:q,answer:'yes'},f.ids[2],new Date(now.getTime()+3600000)),/settled|deadline/);
 assert.equal((await d.query<{state:string}>('SELECT state FROM questions WHERE id=$1',[q])).rows[0].state,'void');
 assert.equal((await d.query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1',[q])).rows[0].points_tenths,0);
});
test('blocking preserves essential proposal, dispute and settlement alerts with deduplication',async()=>{
 const f=await fixture(),q=await question(f.g,f.ids[0]);await pick(q,f.ids[1]);
 await lifecycle({action:'block',invite:f.invite,targetId:f.ids[0]},f.ids[1],now);
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 await lifecycle({action:'dispute',invite:f.invite,questionId:q},f.ids[1],now);
 await lifecycle({action:'judge',invite:f.invite,questionId:q,answer:'yes'},f.ids[2],now);
 await lifecycle({action:'tick',invite:f.invite},f.ids[2],now);
 const alerts=(await(await db()).query<{stage:string;essential:boolean}>('SELECT stage,essential FROM alerts WHERE question_id=$1 AND user_id=$2',[q,f.ids[1]])).rows;
 assert.deepEqual(alerts.map(a=>a.stage).sort(),['disputed','proposed','settled']);assert.ok(alerts.every(a=>a.essential));
});
test('pending long-term points credit once at 30-day cutoff; after cutoff points never enter later standings',async()=>{
 const f=await fixture(),d=await db(),q=await question(f.g,f.ids[0],'longterm');await pick(q,f.ids[1],'yes',10);
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 const settled=new Date(now.getTime()+DAY),cutoff=new Date(settled.getTime()+30*DAY);
 await lifecycle({action:'tick',invite:f.invite},f.ids[2],settled);
 assert.equal((await d.query<{allocation:string}>('SELECT allocation FROM scores WHERE question_id=$1',[q])).rows[0].allocation,'pending');
 await lifecycle({action:'season',invite:f.invite,name:'Next',startsAt:cutoff.toISOString(),endsAt:new Date(cutoff.getTime()+10*DAY).toISOString()},f.ids[2],new Date(settled.getTime()+DAY));
 await lifecycle({action:'tick',invite:f.invite},f.ids[2],new Date(cutoff.getTime()+DAY));
 await lifecycle({action:'tick',invite:f.invite},f.ids[2],new Date(cutoff.getTime()+2*DAY));
 const score=(await d.query<{allocation:string;points_tenths:number}>('SELECT * FROM scores WHERE question_id=$1',[q])).rows[0];assert.equal(score.allocation,'credited');assert.equal(score.points_tenths,100);
 const f2=await fixture(),q2=await question(f2.g,f2.ids[0],'longterm');await pick(q2,f2.ids[1],'yes',10);
 await lifecycle({action:'propose',invite:f2.invite,questionId:q2,answer:'yes'},f2.ids[0],now);
 await lifecycle({action:'tick',invite:f2.invite},f2.ids[2],new Date(cutoff.getTime()+1));
 assert.equal((await d.query<{allocation:string}>('SELECT allocation FROM scores WHERE question_id=$1',[q2])).rows[0].allocation,'expired');
 await lifecycle({action:'season',invite:f2.invite,name:'Too late',startsAt:new Date(cutoff.getTime()+DAY).toISOString(),endsAt:new Date(cutoff.getTime()+10*DAY).toISOString()},f2.ids[2],cutoff);
 await lifecycle({action:'tick',invite:f2.invite},f2.ids[2],new Date(cutoff.getTime()+2*DAY));
 assert.equal((await d.query<{allocation:string}>('SELECT allocation FROM scores WHERE question_id=$1',[q2])).rows[0].allocation,'expired');
});
test('last question slot is atomic and retried creation returns the original question',async()=>{
 const f=await fixture(),d=await db();const start=new Date(Date.now()-3600000);await d.query('DELETE FROM round_members WHERE round_id IN(SELECT id FROM rounds WHERE group_id=$1)',[f.g]);await d.query('DELETE FROM rounds WHERE group_id=$1',[f.g]);await d.query('UPDATE groups SET opens_at=$1,next_round_at=$1 WHERE id=$2',[start,f.g]);await d.query('UPDATE membership_periods SET joined_at=$1 WHERE group_id=$2',[new Date(start.getTime()-1000),f.g]);await d.query('UPDATE seasons SET starts_at=$1,ends_at=$2 WHERE group_id=$3',[start,new Date(start.getTime()+56*DAY),f.g]);
 for(let i=0;i<5;i++)await question(f.g,f.ids[0]);
 const requestId=randomUUID();const payload={action:'question',invite:f.invite,text:'Will the last slot work?',locksAt:new Date(Date.now()+3600000).toISOString(),requestId};
 const results=await Promise.allSettled([execute(payload,f.sessions[0]),execute({...payload,requestId:randomUUID()},f.sessions[1])]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 if(results[0].status==='fulfilled')assert.equal((await execute(payload,f.sessions[0])).questionId,results[0].value.questionId);
 assert.equal(Number((await d.query<{count:string}>("SELECT count(*) FROM questions WHERE group_id=$1 AND scope='weekly'",[f.g])).rows[0].count),6);
});
test('locked long-term predictions remain forfeited after rejoining, preserving the crowd share',async()=>{
 const f=await fixture(),d=await db(),q=await question(f.g,f.ids[0],'longterm');await pick(q,f.ids[1],'yes',10);await pick(q,f.ids[2],'no',10);
 await lifecycle({action:'leave',invite:f.invite},f.ids[1],now);
 await execute({action:'join',invite:f.invite},f.sessions[1]);
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 await lifecycle({action:'tick',invite:f.invite},f.ids[2],new Date(now.getTime()+DAY));
 assert.equal((await d.query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1 AND user_id=$2',[q,f.ids[1]])).rows[0].points_tenths,0);
 assert.equal((await d.query('SELECT * FROM predictions WHERE question_id=$1',[q])).rows.length,2);
});
