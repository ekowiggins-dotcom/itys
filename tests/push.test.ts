import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {generateKeyPairSync,verify} from 'node:crypto';
import {db} from '../lib/db';import {execute,identity} from '../lib/service';import {runScheduler} from '../lib/scheduler';
import {providerToken,apnsConfig,type Transport} from '../lib/push/apns';import {deliverPending} from '../lib/push/deliver';
import {sessionToken,isNativeOrigin,corsHeaders} from '../lib/native-client';
const folder=await mkdtemp(join(tmpdir(),'push-'));process.env.PREDICTION_DATA_DIR=folder;
after(async()=>{await(await db()).close();await rm(folder,{recursive:true,force:true})});
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
const cfg={teamId:'TEAM123456',keyId:'KEY1234567',key:privateKey.export({type:'pkcs8',format:'pem'}).toString(),bundleId:'app.calld.ios'};
const tok=(c:string)=>c.repeat(64);

test('provider token is a valid ES256 JWT for the team and key',()=>{
 const jwt=providerToken(cfg,Date.parse('2030-01-01T00:00:00Z'));const [h,c,sig]=jwt.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(h,'base64url').toString()),{alg:'ES256',kid:cfg.keyId});
 assert.equal(JSON.parse(Buffer.from(c,'base64url').toString()).iss,cfg.teamId);
 assert.ok(verify('sha256',Buffer.from(h+'.'+c),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')));
 assert.equal(providerToken(cfg,Date.parse('2030-01-01T00:10:00Z')),jwt,'reused within the hour');
 assert.equal(apnsConfig({}),null);assert.ok(apnsConfig({APNS_TEAM_ID:'t',APNS_KEY_ID:'k',APNS_KEY:'a\\nb',IOS_BUNDLE_ID:'b'})?.key.includes('\n'));
});

test('app requests: bearer sessions and the Capacitor origin are accepted, others are not',()=>{
 const s='a'.repeat(64);assert.equal(sessionToken(undefined,'Bearer '+s),s);assert.equal(sessionToken('cookie','Bearer '+s),'cookie');
 assert.equal(sessionToken(undefined,'Bearer short'),undefined);assert.equal(sessionToken(undefined,null),undefined);
 assert.ok(isNativeOrigin('capacitor://localhost'));assert.ok(!isNativeOrigin('https://evil.example'));assert.ok(!isNativeOrigin(null));
 assert.equal(corsHeaders('https://evil.example')['Access-Control-Allow-Origin'],undefined);
 assert.equal(corsHeaders('capacitor://localhost')['Access-Control-Allow-Origin'],'capacitor://localhost');
});

test('queued alerts are pushed with deep-link data; dead tokens are disabled; no device is recorded',async()=>{
 const base=new Date('2030-04-07T12:00:00Z'),monday=new Date('2030-04-08T00:00:00Z');
 const a=await execute({action:'create',name:'Ana',groupName:'Push crew'},undefined,base),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Ben'},undefined,base),c=await execute({action:'join',invite,name:'Cem'},undefined,base);
 await execute({action:'registerDevice',token:tok('a'),environment:'sandbox'},a.session,base);
 await execute({action:'registerDevice',token:tok('b')},b.session,base);
 await assert.rejects(execute({action:'registerDevice',token:'not-hex'},a.session,base));
 const sent:{env:string;token:string;headers:Record<string,string>;body:any}[]=[];
 const transport:Transport=async(env,token,headers,body)=>{sent.push({env,token,headers,body:JSON.parse(body)});return token===tok('b')?{status:410,reason:'Unregistered'}:{status:200}};
 await runScheduler(monday); // opens the round -> queued 'round_open' alerts for all three
 const r=await deliverPending(monday,cfg,transport);
 assert.equal(r.sent,1);
 const toAna=sent.find(s=>s.token===tok('a'))!;
 assert.equal(toAna.env,'sandbox');assert.equal(toAna.headers['apns-topic'],cfg.bundleId);assert.match(toAna.headers.authorization,/^bearer /);
 assert.equal(toAna.body.aps.alert.title,'A new round is open');assert.equal(toAna.body.invite,invite);assert.ok(toAna.body.roundId);
 const d=await db();const ids=await Promise.all([a,b,c].map(x=>identity(x.session)));
 const status=async(u:string)=>(await d.query<{push_status:string}>("SELECT push_status FROM notifications WHERE user_id=$1 AND kind='round_open'",[u])).rows[0].push_status;
 assert.equal(await status(ids[0]!.id),'sent');assert.equal(await status(ids[1]!.id),'failed');assert.equal(await status(ids[2]!.id),'no_device');
 assert.equal((await d.query<{disabled_reason:string}>('SELECT disabled_reason FROM devices WHERE token=$1',[tok('b')])).rows[0].disabled_reason,'Unregistered');
 assert.equal((await deliverPending(monday,cfg,transport)).sent,0,'nothing is sent twice');
 assert.deepEqual(await deliverPending(monday,null,transport),{sent:0,skipped:'not_configured'});
});
