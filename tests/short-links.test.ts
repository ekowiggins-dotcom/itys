import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {db} from '../lib/db';import {execute,view,betPreview} from '../lib/service';import {runScheduler} from '../lib/scheduler';
import {resolveCode,shortLink,validCode,newCode} from '../lib/short-links';import {publicShare} from '../lib/share-data';import {shareText} from '../lib/sharing';
const folder=await mkdtemp(join(tmpdir(),'short-links-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});

test('codes are short, unambiguous and links are tidy',()=>{
 for(let i=0;i<50;i++){const c=newCode();assert.equal(c.length,7);assert.ok(validCode(c));assert.ok(!/[01lIO]/.test(c))}
 assert.equal(shortLink('https://calld.app/some/path?x=1','k7Qm2xa'),'https://calld.app/c/k7Qm2xa');
 assert.ok(!validCode('../etc'));assert.throws(()=>shortLink('javascript:alert(1)','abcde'));
});

test('every group, call and round gets a short link that opens the right thing',async()=>{
 const base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');
 const a=await execute({action:'create',name:'Arda',groupName:'Sunday League Lads'},undefined,base),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Ege'},undefined,base);await execute({action:'join',invite,name:'Can'},undefined,base);
 await runScheduler(monday);
 const q=(await execute({action:'question',invite,text:'Fenerbahçe’s next coach?',locksAt:new Date(monday.getTime()+3600000).toISOString(),options:['Emre','Aykut','Sergio','Nagelsmann']},a.session,monday)).questionId!;
 await execute({action:'predict',invite,questionId:q,answer:'Aykut',stake:20},b.session,monday);
 const v=await view(invite,a.session,undefined,monday) as unknown as {group:{share_code:string};questions:{id:string;share_code:string}[];bets:{id:string;picker_ids:string[];answer:string|null}[]};
 assert.ok(validCode(v.group.share_code));
 const call=v.questions.find(x=>x.id===q)!;assert.ok(validCode(call.share_code));
 assert.deepEqual(await resolveCode(v.group.share_code),{invite});
 assert.deepEqual(await resolveCode(call.share_code),{invite,questionId:q,roundId:(await resolveCode(call.share_code))!.roundId});
 assert.equal(await resolveCode('nope1'),null);
 // Who's in is visible before lock; what they picked is not.
 const bet=v.bets.find(x=>x.id===q)!;assert.equal(bet.picker_ids.length,1);assert.equal(bet.answer,null);
 // The preview shows the call's own options and who made it, never the picks.
 const share=await publicShare(invite,{questionId:q},monday);
 assert.deepEqual(share.card.options,['Emre','Aykut','Sergio','Nagelsmann']);assert.equal(share.card.creator,'Arda');
 assert.match(share.card.detail,/1 friend is in/);assert.match(share.card.when!,/Picks close/);
 assert.ok(!JSON.stringify(share).includes('Ege'),'the people who picked are never named in a call preview');
 const text=shareText(share.card,'https://calld.app/c/'+call.share_code);assert.equal(text.split('\n').length,2);
 const groupShare=await publicShare(invite,{},monday);assert.equal(groupShare.card.kind,'invite');assert.deepEqual(groupShare.card.members,['Arda','Ege','Can']);
 assert.equal((await betPreview(invite,q))?.creator_name,'Arda');
});
