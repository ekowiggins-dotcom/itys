import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';import {execute,identity} from '../lib/service';import {lifecycle} from '../lib/lifecycle';
const folder=await mkdtemp(join(tmpdir(),'resolution-fixes-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
const DAY=86400000,HOUR=3600000;const now=new Date('2030-04-10T12:00:00Z');
async function group(names:string[]){
 const a=await execute({action:'create',name:names[0],groupName:'Fixes'}),invite=a.invite!;const rest=[];
 for(const n of names.slice(1))rest.push(await execute({action:'join',invite,name:n}));
 const ids=(await Promise.all([a,...rest].map(x=>identity(x.session)))).map(u=>u!.id);const d=await db();
 const g=(await d.query<{id:string}>('SELECT id FROM groups WHERE invite=$1',[invite])).rows[0].id;
 await d.query('UPDATE groups SET opens_at=$1 WHERE id=$2',[new Date(now.getTime()-3*DAY),g]);
 return {invite,g,ids};
}
async function bet(g:string,creator:string,event:Date){
 const d=await db(),id=randomUUID();
 await d.query('INSERT INTO questions(id,group_id,creator,text,locks_at,scope,event_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,g,creator,'Will it happen?',new Date(event.getTime()-DAY),'weekly',event]);return id;
}
const state=async(q:string)=>(await(await db()).query<{state:string;result_answer:string|null}>('SELECT state,result_answer FROM questions WHERE id=$1',[q])).rows[0];

test('an undisputed late proposal settles with its answer when the shortened window closes',async()=>{
 const f=await group(['Creator','Player','Third']),d=await db();
 const event=new Date(now.getTime()-7*DAY+2*HOUR); // resolution deadline is 2h after "now"
 const q=await bet(f.g,f.ids[0],event);
 await d.query('INSERT INTO predictions(question_id,user_id,answer,stake) VALUES($1,$2,$3,$4)',[q,f.ids[1],'yes',20]);
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 await lifecycle({action:'tick',invite:f.invite},f.ids[0],new Date(now.getTime()+HOUR));
 assert.equal((await state(q)).state,'proposed','still open for disputes before the deadline');
 await lifecycle({action:'tick',invite:f.invite},f.ids[0],new Date(now.getTime()+3*HOUR));
 assert.deepEqual(await state(q),{state:'settled',result_answer:'yes'});
 // Lone correct pick: 20 x (2 - 1/1) = 20.0
 assert.equal((await d.query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1 AND user_id=$2',[q,f.ids[1]])).rows[0].points_tenths,100);
});

test('a late proposal disputed before the deadline: the vote closes at the deadline, most votes wins',async()=>{
 const f=await group(['Creator','Player','Third']);
 const q=await bet(f.g,f.ids[0],new Date(now.getTime()-7*DAY+2*HOUR));
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},f.ids[0],now);
 await lifecycle({action:'dispute',invite:f.invite,questionId:q},f.ids[1],new Date(now.getTime()+HOUR));
 await lifecycle({action:'voteResult',invite:f.invite,questionId:q,answer:'no'},f.ids[1],new Date(now.getTime()+HOUR));
 await lifecycle({action:'tick',invite:f.invite},f.ids[0],new Date(now.getTime()+3*HOUR));
 assert.deepEqual(await state(q),{state:'settled',result_answer:'no'});
});

test('two days late anyone can settle; a dispute then goes to a public group vote',async()=>{
 const f=await group(['Creator','Disputer','Admin','Neutral']),d=await db();
 const [creator,disputer,admin,neutral]=f.ids;
 await d.query('UPDATE groups SET admin=$1,fallback_id=NULL WHERE id=$2',[admin,f.g]);
 const q=await bet(f.g,creator,new Date(now.getTime()-3*DAY)); // >48h after event: takeover allowed
 await lifecycle({action:'propose',invite:f.invite,questionId:q,answer:'yes'},admin,now);
 assert.equal((await d.query<{proposed_by:string}>('SELECT proposed_by FROM questions WHERE id=$1',[q])).rows[0].proposed_by,admin);
 await lifecycle({action:'dispute',invite:f.invite,questionId:q},disputer,new Date(now.getTime()+HOUR));
 await assert.rejects(lifecycle({action:'dispute',invite:f.invite,questionId:q},neutral,new Date(now.getTime()+HOUR)),/closed/,'one vote per call');
 // Everyone but the disputer is asked; votes are public and can change until the vote closes.
 const asked=(await d.query<{user_id:string}>("SELECT user_id FROM notifications WHERE question_id=$1 AND kind='dispute' ORDER BY user_id",[q])).rows.map(r=>r.user_id);
 assert.deepEqual(asked,[creator,admin,neutral].sort());
 const at=new Date(now.getTime()+2*HOUR);
 await lifecycle({action:'voteResult',invite:f.invite,questionId:q,answer:'yes'},admin,at);
 await lifecycle({action:'voteResult',invite:f.invite,questionId:q,answer:'no'},disputer,at);
 await lifecycle({action:'voteResult',invite:f.invite,questionId:q,answer:'no'},neutral,at);
 await lifecycle({action:'voteResult',invite:f.invite,questionId:q,answer:'yes'},neutral,at);
 assert.equal((await state(q)).state,'disputed','2–2 so far is still open: Creator hasn’t voted');
 await lifecycle({action:'voteResult',invite:f.invite,questionId:q,answer:'no'},creator,at);
 assert.deepEqual(await state(q),{state:'settled',result_answer:'yes'},'everyone voted: 3 yes, 1 no');
 const told=(await d.query<{text:string}>("SELECT text FROM notifications WHERE question_id=$1 AND user_id=$2 AND kind='settlement' ORDER BY created_at DESC LIMIT 1",[q,disputer])).rows[0].text;
 assert.match(told,/The group kept the result/);
});
