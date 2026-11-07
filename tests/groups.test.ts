import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'groups-'));process.env.PREDICTION_DATA_DIR=dir;
const {db}=await import('../lib/db');const {execute,myGroups,view}=await import('../lib/service');
const {parseInvite}=await import('../lib/invite-input');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

const INV='0123456789abcdef0123456789abcdef01234567'.slice(0,36);

test('pasted invites: long links, short links, bare codes, chat text around them',()=>{
 assert.deepEqual(parseInvite(`https://itys-production.up.railway.app/?invite=${INV}`),{invite:INV});
 assert.deepEqual(parseInvite(`Join us 👀 https://wholl.app/?invite=${INV}&question=x.`),{invite:INV});
 assert.deepEqual(parseInvite('Who’s your pick? 👀 https://itys-production.up.railway.app/c/AbC2345'),{code:'AbC2345'});
 assert.deepEqual(parseInvite('  AbC2345 '),{code:'AbC2345'});
 assert.deepEqual(parseInvite(INV.toUpperCase()),{invite:INV});
 assert.equal(parseInvite(''),null);
 assert.equal(parseInvite('hello there friends'),null);
 assert.equal(parseInvite('https://example.com/about'),null);
});

test('one person, several groups: listed most recent first, and joining a second keeps your name',async()=>{
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',startNow:true});
 const b=await execute({action:'create',name:'Can',groupName:'Flat',startNow:true});
 assert.deepEqual((await myGroups(undefined)).groups,[]);
 assert.deepEqual((await myGroups(a.session)).groups.map(g=>g.name),['Agalar']);
 // Arda opens the Flat link: the join screen already knows who he is.
 const before=await view(b.invite!,a.session) as {joined:boolean;me?:string|null};
 assert.equal(before.joined,false);assert.equal(before.me,'Arda');
 await execute({action:'join',invite:b.invite,name:'Somebody else'},a.session);
 const mine=await myGroups(a.session);
 assert.equal(mine.me,'Arda');
 assert.deepEqual(mine.groups.map(g=>[g.name,g.members]).sort(),[['Agalar',1],['Flat',2]]);
 await view(a.invite!,a.session,undefined,new Date(Date.now()+60000));
 assert.equal((await myGroups(a.session)).groups[0].name,'Agalar');
 const flat=await view(b.invite!,a.session) as {memberNames?:string[];members:number;joined:boolean};
 assert.equal(flat.joined,true);
});

test('app accounts are saved with Apple: a new Apple ID says so plainly, then attaches to the account just made',async()=>{
 const {appleSignIn,AppleError}=await import('../lib/apple');
 await assert.rejects(appleSignIn('apple-new'),(e:unknown)=>e instanceof AppleError&&e.code==='no_account');
 const g=await execute({action:'create',name:'Deniz',groupName:'Book club',startNow:true});
 assert.equal((await myGroups(g.session)).linked,false);
 const {identity}=await import('../lib/service');
 const linked=await appleSignIn('apple-new',(await identity(g.session))!.id);
 assert.equal(linked.invite,g.invite);
 assert.equal((await myGroups(linked.session)).linked,true);
 // Same Apple ID on a new phone: straight back into the same account and group.
 const again=await appleSignIn('apple-new');
 assert.deepEqual((await myGroups(again.session)).groups.map(x=>x.name),['Book club']);
});
