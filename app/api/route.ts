import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { execute, view, betPreview, RuleError } from '../../lib/service';
import { ZodError } from 'zod';
import { LifecycleError } from '../../lib/lifecycle';
import { corsHeaders, isNativeOrigin, sessionToken } from '../../lib/native-client';
import { practiceAllowed } from '../../lib/timing';
import { resolveCode } from '../../lib/short-links';
import { identity } from '../../lib/service';
import { verifyAppleToken, appleSignIn, AppleError } from '../../lib/apple';
export const runtime='nodejs';
async function token(req:NextRequest){return sessionToken((await cookies()).get('prediction_session')?.value,req.headers.get('authorization'));}
export async function OPTIONS(req:NextRequest){const headers=corsHeaders(req.headers.get('origin'));return new NextResponse(null,{status:Object.keys(headers).length?204:403,headers});}
export async function GET(req:NextRequest) {
  const cors=corsHeaders(req.headers.get('origin'));
  try {
    if(req.nextUrl.searchParams.get('config')!==null)return NextResponse.json({practiceAllowed:practiceAllowed(),appleServicesId:process.env.APPLE_SERVICES_ID||null,appStoreUrl:process.env.APP_STORE_URL||null},{headers:{'Cache-Control':'no-store',...cors}});
    // The app opens short links (/c/<code>) itself, so it asks what a code points at.
    const code=req.nextUrl.searchParams.get('code');if(code!==null){const target=await resolveCode(code);return NextResponse.json(target||{error:'This link has expired.'},{status:target?200:404,headers:{'Cache-Control':'no-store',...cors}});}
    const invite=req.nextUrl.searchParams.get('invite')||'',question=req.nextUrl.searchParams.get('question');
    const result=await view(invite,await token(req),req.nextUrl.searchParams.get('round')||undefined);
    const preview=question&&!result.joined?await betPreview(invite,question):null;
    return NextResponse.json({...result,preview},{headers:{'Cache-Control':'no-store',...cors}});
  }
  catch(e){ return NextResponse.json({error:(e instanceof RuleError || e instanceof LifecycleError)?e.message:'Unable to load group.'},{status:400,headers:cors}); }
}
export async function POST(req:NextRequest) {
  const origin=req.headers.get('origin'),cors=corsHeaders(origin),native=isNativeOrigin(origin);
  try {
    if(!origin || (!native && new URL(origin).host!==req.headers.get('host'))) return NextResponse.json({error:'Invalid request origin.'},{status:403,headers:cors});
    const input=await req.json();
    // Sign in with Apple: links this device to the person's account (web or app). Doesn't touch points.
    if(input?.action==='appleSignIn'){
      const {sub}=await verifyAppleToken(String(input.idToken||''));const me=await identity(await token(req));
      const {session,invite}=await appleSignIn(sub,me?.id);
      const response=NextResponse.json(native?{invite,session}:{invite},{headers:cors});
      if(!native)response.cookies.set('prediction_session',session,{httpOnly:true,secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*365});
      return response;
    }
    const result=await execute(input,await token(req));
    const {session,...body}=result;
    // The app has no cookie jar shared with the web, so it receives its session once and sends it back as a Bearer token.
    const response=NextResponse.json(native&&session?{...body,session}:body,{headers:cors});
    if(session&&!native) response.cookies.set('prediction_session',session,{httpOnly:true,secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*90});
    return response;
  } catch(e) { return NextResponse.json({error:(e instanceof RuleError || e instanceof LifecycleError || e instanceof AppleError)?e.message:e instanceof ZodError?'Check the name, question, date, and points you entered.':'Unable to save. Please try again.'},{status:400,headers:cors}); }
}
