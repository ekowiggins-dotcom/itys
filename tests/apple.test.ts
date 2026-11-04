import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {generateKeyPairSync,createSign} from 'node:crypto';
const dir=await mkdtemp(join(tmpdir(),'apple-'));process.env.PREDICTION_DATA_DIR=dir;process.env.PRACTICE_GROUPS='1';
const {db}=await import('../lib/db');const {runScheduler}=await import('../lib/scheduler');const {execute,view,identity}=await import('../lib/service');const {verifyAppleToken,appleSignIn}=await import('../lib/apple');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'k1',alg:'RS256'} as unknown as {kid:string;kty:string;n:string;e:string;alg:string};
const b64=(o:object)=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(claims:Record<string,unknown>,key=privateKey){const head=b64({alg:'RS256',kid:'k1'}),body=b64({iss:'https://appleid.apple.com',aud:'app.calld.web',exp:Math.floor(Date.now()/1000)+600,sub:'apple-1',...claims});
 return head+'.'+body+'.'+createSign('RSA-SHA256').update(head+'.'+body).sign(key).toString('base64url')}
const opts={audiences:['app.calld.web','app.calld.ios'],keys:[jwk]};

test('only a real, fresh Apple token for this app is accepted',async()=>{
 assert.equal((await verifyAppleToken(token({}),opts)).sub,'apple-1');
 assert.equal((await verifyAppleToken(token({aud:'app.calld.ios'}),opts)).sub,'apple-1','the iOS app’s audience works too');
 await assert.rejects(verifyAppleToken(token({aud:'someone.else'}),opts));
 await assert.rejects(verifyAppleToken(token({exp:Math.floor(Date.now()/1000)-5}),opts));
 await assert.rejects(verifyAppleToken(token({iss:'https://evil.example'}),opts));
 const other=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;await assert.rejects(verifyAppleToken(token({},other),opts),'signed by someone else');
});

test('pick on the web, save with Apple, open the app: same account, the pick is still there',async()=>{
 const a=await execute({action:'create',name:'Arda',groupName:'Agalar',practice:true});const invite=a.invite!;
 const web=await execute({action:'join',invite,name:'Ege'});await execute({action:'join',invite,name:'Can'});await runScheduler(new Date());
 const q=(await execute({action:'question',invite,text:'Will Can be late?',locksAt:new Date(Date.now()+10*60000).toISOString()},a.session)).questionId!;await execute({action:'predict',invite,questionId:q,answer:'yes'},web.session);
 const ege=(await identity(web.session))!.id;
 // On the web, after the first pick: Sign in with Apple links the account.
 const saved=await appleSignIn('apple-ege',ege);assert.equal(saved.invite,invite);
 // In the app: no session yet. The same Apple ID finds Ege, with the group and the pick.
 const app=await appleSignIn('apple-ege');assert.equal((await identity(app.session))!.id,ege);assert.equal(app.invite,invite);
 const v=await view(invite,app.session) as unknown as {linked:boolean;bets:unknown[]};assert.equal(v.linked,true);assert.equal((v.bets as {id:string;answer:string}[]).find(b=>b.id===q)?.answer,'yes');
 await assert.rejects(appleSignIn('apple-nobody'),/No calls are saved/);
 await assert.rejects(appleSignIn('apple-other',ege),/different Apple ID/);
 assert.equal(((await view(invite,a.session)) as unknown as {linked:boolean}).linked,false);
});
