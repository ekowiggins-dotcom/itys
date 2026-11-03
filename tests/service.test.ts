import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db } from '../lib/db';
import { execute,view } from '../lib/service';
const folder=await mkdtemp(join(tmpdir(),'prediction-test-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await (await db()).close();await rm(folder,{recursive:true,force:true})});
test('invite, identity, capacity, privacy, concurrency, edits and lock enforcement',async()=>{
 const owner=await execute({action:'create',name:'Maya',groupName:'Weekend crew'});const invite=owner.invite!;
 assert.equal((await view(invite)).questions.length,0);
 await assert.rejects(execute({action:'question',invite,text:'Will it rain?',locksAt:new Date(Date.now()+3600000).toISOString()},owner.session),/three members/);
 const friend=await execute({action:'join',invite,name:'Alex'});
 await execute({action:'join',invite,name:'Sam'});
 const d=await db();
 // Advance the scheduled round into its opening week for deterministic tests.
 const opened=new Date(Date.now()-3600000);
 await d.query('DELETE FROM round_members WHERE round_id IN(SELECT id FROM rounds WHERE group_id=(SELECT id FROM groups WHERE invite=$1))',[invite]);
 await d.query('DELETE FROM rounds WHERE group_id=(SELECT id FROM groups WHERE invite=$1)',[invite]);
 await d.query('UPDATE groups SET opens_at=$1,next_round_at=$1 WHERE invite=$2',[opened,invite]);
 await d.query('UPDATE membership_periods SET joined_at=$1 WHERE group_id=(SELECT id FROM groups WHERE invite=$2)',[new Date(opened.getTime()-1000),invite]);
 await d.query('UPDATE seasons SET starts_at=$1,ends_at=$2 WHERE group_id=(SELECT id FROM groups WHERE invite=$3)',[opened,new Date(opened.getTime()+56*86400000),invite]);
 const ids:string[]=[];
 for(let i=0;i<6;i++) {const q=await execute({action:'question',invite,text:'Will plan '+i+' happen?',locksAt:new Date(Date.now()+3600000).toISOString()},owner.session);ids.push(q.questionId!)}
 await assert.rejects(execute({action:'question',invite,text:'Overflow?',locksAt:new Date(Date.now()+3600000).toISOString()},owner.session),/six call slots/);
 await execute({action:'predict',invite,questionId:ids[0],answer:'yes',stake:30},owner.session);
 await execute({action:'predict',invite,questionId:ids[1],answer:'no',stake:30},owner.session);
 const concurrent=await Promise.allSettled([2,3].map(i=>execute({action:'predict',invite,questionId:ids[i],answer:'yes',stake:30},owner.session)));
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await view(invite,owner.session)).used,90);
 const friendView=await view(invite,friend.session);assert.equal(friendView.questions[0].answer,null);
 await execute({action:'predict',invite,questionId:ids[0],answer:'no',stake:10},owner.session);
 assert.equal((await view(invite,owner.session)).used,70);
 await assert.rejects(execute({action:'predict',invite,questionId:ids[4],answer:'yes',stake:7},owner.session));
 await d.query('UPDATE questions SET locks_at=$1 WHERE id=$2',[new Date(Date.now()-1000).toISOString(),ids[0]]);
 await assert.rejects(execute({action:'predict',invite,questionId:ids[0],answer:'yes',stake:5},owner.session),/locked/);
 assert.equal((await view(invite,owner.session)).used,70);
});
