import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute} from '../lib/service';
import {groupDefaults} from '../lib/locale';import {leaguePack} from '../lib/locale';import {importance,period,type Fixture} from '../lib/football/rules';
const folder=await mkdtemp(join(tmpdir(),'locale-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});

test('group defaults follow the creator’s time zone, not a hardcoded country',()=>{
 assert.deepEqual(groupDefaults({timezone:'Europe/London'}),{timezone:'Europe/London',country:'GB',leagues:leaguePack(39)});
 assert.deepEqual(groupDefaults({timezone:'America/Sao_Paulo'}),{timezone:'America/Sao_Paulo',country:'BR',leagues:leaguePack(71)});
 // Time zone beats an English phone's en-US language region.
 assert.deepEqual(groupDefaults({timezone:'Europe/Istanbul',country:'US'}),{timezone:'Europe/Istanbul',country:'TR',leagues:leaguePack(203)});
 // Unmapped time zone: fall back to the reported country.
 assert.deepEqual(groupDefaults({timezone:'Africa/Lagos',country:'es'}),{timezone:'Africa/Lagos',country:'ES',leagues:leaguePack(140)});
 // Nothing known: global default league, UTC.
 assert.deepEqual(groupDefaults({}),{timezone:'UTC',country:'GB',leagues:leaguePack(39)});
});

test('a new group stores the creator’s locale and its Sunday deadline is local',async()=>{
 const a=await execute({action:'create',name:'Ana',groupName:'Lisbon? no, São Paulo',timezone:'America/Sao_Paulo',country:'BR'});
 const g=(await(await db()).query<{timezone:string;country:string;leagues:number[]}>('SELECT timezone,country,leagues FROM groups WHERE invite=$1',[a.invite])).rows[0];
 assert.deepEqual(g,{timezone:'America/Sao_Paulo',country:'BR',leagues:leaguePack(71)});
 // Friends round opening Monday 00:00 São Paulo (UTC-3): deadline Sunday 23:59 local = Monday 02:59 UTC.
 const p=period(new Date('2030-04-08T03:00:00Z'),'Friends','America/Sao_Paulo');
 assert.equal(p.deadline.toISOString(),'2030-04-15T02:59:00.000Z');
 await assert.rejects(execute({action:'create',name:'X',groupName:'Bad zone',timezone:'Mars/Olympus'}),/valid time zone/);
});

test('featured-match importance uses each league’s own derbies and big clubs',()=>{
 const f=(league:number,home:string,away:string):Fixture=>({id:'x',provider:'p',provider_id:1,league_id:league,league_name:'',home,away,kickoff:'2030-01-01T00:00:00Z',status:'scheduled',home90:null,away90:null,home_rank:null,away_rank:null,revision:'1'});
 assert.equal(importance(f(39,'Arsenal','Tottenham')).reason,'North London derby');
 assert.equal(importance(f(39,'Manchester City','Manchester United')).reason,'Manchester derby');
 assert.equal(importance(f(39,'Liverpool','Chelsea')).reason,'Major club meeting');
 assert.equal(importance(f(140,'Real Madrid','Barcelona')).reason,'El Clásico');
 assert.equal(importance(f(203,'Galatasaray','Fenerbahçe')).reason,'Istanbul derby');
 assert.equal(importance(f(203,'Trabzonspor','Galatasaray')).reason,'Major club meeting');
 // Turkish clubs are no longer "big" in other leagues' logic, and unknown leagues fall back to table positions.
 assert.equal(importance(f(39,'Fulham','Brentford')).score,0);
 assert.equal(importance(f(999,'Galatasaray','Fenerbahçe')).reason,'Scheduled league fixture');
});
