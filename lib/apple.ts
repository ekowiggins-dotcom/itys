// Sign in with Apple: one account on the web and in the app. Points are untouched: this only decides which account a device is.
import {createPublicKey,createVerify,randomBytes} from 'node:crypto';
import {db} from './db';

type Jwk={kid:string;kty:string;n:string;e:string;alg:string};
let keys:{at:number;list:Jwk[]}|null=null;
async function appleKeys(fetcher=fetch):Promise<Jwk[]>{
 if(keys&&Date.now()-keys.at<3600000)return keys.list;
 const r=await fetcher('https://appleid.apple.com/auth/keys');if(!r.ok)throw new AppleError('Apple sign-in is unavailable right now. Try again in a minute.');
 keys={at:Date.now(),list:((await r.json()) as {keys:Jwk[]}).keys};return keys.list;
}
export class AppleError extends Error{}
const b64=(s:string)=>Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64');
/** Who signed in: Apple's stable user id. Checks the signature, issuer, audience (web Services ID or the app's bundle id) and expiry. */
export async function verifyAppleToken(idToken:string,opts:{audiences?:string[];now?:number;keys?:Jwk[]}={}):Promise<{sub:string}>{
 const parts=idToken.split('.');if(parts.length!==3)throw new AppleError('That Apple sign-in didn’t work. Try again.');
 const header=JSON.parse(b64(parts[0]).toString()),payload=JSON.parse(b64(parts[1]).toString());
 const jwk=(opts.keys||await appleKeys()).find(k=>k.kid===header.kid);if(!jwk||header.alg!=='RS256')throw new AppleError('That Apple sign-in didn’t work. Try again.');
 const ok=createVerify('RSA-SHA256').update(parts[0]+'.'+parts[1]).verify(createPublicKey({key:jwk as unknown as import('node:crypto').JsonWebKey,format:'jwk'}),b64(parts[2]));
 const audiences=opts.audiences||[process.env.APPLE_SERVICES_ID,process.env.IOS_BUNDLE_ID||'app.calld.ios'].filter(Boolean) as string[];
 const now=(opts.now??Date.now())/1000;
 if(!ok||payload.iss!=='https://appleid.apple.com'||!audiences.includes(payload.aud)||!(payload.exp>now)||typeof payload.sub!=='string')throw new AppleError('That Apple sign-in didn’t work. Try again.');
 return{sub:payload.sub};
}
/**
 * Link this device to an Apple account, or switch to the account already linked.
 * - Picked on the web, first Apple sign-in: the web account gets the Apple id (the pick stays).
 * - New phone or the app: the Apple id finds the account, and this device gets a session for it.
 */
export async function appleSignIn(sub:string,currentUserId?:string){
 const d=await db();
 return d.transaction(async tx=>{
  const linked=(await tx.query<{id:string}>('SELECT id FROM users WHERE apple_sub=$1',[sub])).rows[0];
  let userId=linked?.id;
  if(!userId){
   if(!currentUserId)throw new AppleError('No calls are saved with this Apple ID yet. Open a link from a friend to make your first call.');
   const current=(await tx.query<{apple_sub:string|null}>('SELECT apple_sub FROM users WHERE id=$1',[currentUserId])).rows[0];
   if(current?.apple_sub&&current.apple_sub!==sub)throw new AppleError('This account is already saved with a different Apple ID.');
   await tx.query('UPDATE users SET apple_sub=$2 WHERE id=$1',[currentUserId,sub]);userId=currentUserId;
  }
  const session=randomBytes(32).toString('hex');await tx.query('INSERT INTO sessions VALUES($1,$2)',[session,userId]);
  const invite=(await tx.query<{invite:string}>('SELECT g.invite FROM members m JOIN groups g ON g.id=m.group_id WHERE m.user_id=$1 AND m.active ORDER BY m.joined_at DESC LIMIT 1',[userId])).rows[0]?.invite;
  return{session,invite,linked:true};
 });
}
