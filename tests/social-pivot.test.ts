import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'pivot-'));process.env.PREDICTION_DATA_DIR=dir;delete process.env.FOOTBALL;
const {db}=await import('../lib/db');const {execute,view}=await import('../lib/service');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

test('Calld is social: new groups are friends groups and football can’t be switched on from the app',async()=>{
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',groupType:'Football'});
 const v=await view(a.invite!,a.session);assert.equal((v.group as {group_type?:string}).group_type,'Friends','asking for football still makes a friends group');
 await assert.rejects(execute({action:'footballSettings',invite:a.invite,groupType:'Football',timezone:'Europe/Istanbul',country:'TR',leagues:[203]},a.session),/Football isn’t part of Calld/);
});

test('the pivot migration turns football groups into friends groups and takes down open matches',async()=>{
 const d=await db();const a=await execute({action:'create',name:'Selin',groupName:'Old football group'});
 const g=(await d.query<{id:string}>('SELECT id FROM groups WHERE invite=$1',[a.invite])).rows[0].id;
 await d.query("UPDATE groups SET group_type='Football' WHERE id=$1",[g]);
 await d.query("INSERT INTO football_fixtures(id,provider,provider_id,league_id,league_name,home,away,kickoff,status,revision,observed_at) VALUES('fx1','manual',1,203,'Süper Lig','A','B',now()+interval '1 day','scheduled','r1',now())");
 const user=(await d.query<{admin:string}>('SELECT admin FROM groups WHERE id=$1',[g])).rows[0].admin;
 await d.query("INSERT INTO questions(id,group_id,creator,text,locks_at,market,fixture_id) VALUES('q-match',$1,$2,'A vs B · Match result',now()+interval '1 day','result','fx1')",[g,user]);
 await d.exec(await readFile('migrations/020-social-pivot.sql','utf8'));
 assert.equal((await d.query<{group_type:string}>('SELECT group_type FROM groups WHERE id=$1',[g])).rows[0].group_type,'Friends');
 const q=(await d.query<{superseded:boolean;state:string}>("SELECT superseded,state FROM questions WHERE id='q-match'")).rows[0];assert.equal(q.superseded,true);assert.equal(q.state,'void');
});
