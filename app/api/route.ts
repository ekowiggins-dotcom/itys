import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { execute, view, betPreview, RuleError } from '../../lib/service';
import { ZodError } from 'zod';
import { LifecycleError } from '../../lib/lifecycle';
import { corsHeaders, isNativeOrigin, sessionToken } from '../../lib/native-client';
export const runtime='nodejs';
async function token(req:NextRequest){return sessionToken((await cookies()).get('prediction_session')?.value,req.headers.get('authorization'));}
export async function OPTIONS(req:NextRequest){const headers=corsHeaders(req.headers.get('origin'));return new NextResponse(null,{status:Object.keys(headers).length?204:403,headers});}
export async function GET(req:NextRequest) {
  const cors=corsHeaders(req.headers.get('origin'));
  try {
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
    const result=await execute(await req.json(),await token(req));
    const {session,...body}=result;
    // The app has no cookie jar shared with the web, so it receives its session once and sends it back as a Bearer token.
    const response=NextResponse.json(native&&session?{...body,session}:body,{headers:cors});
    if(session&&!native) response.cookies.set('prediction_session',session,{httpOnly:true,secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*90});
    return response;
  } catch(e) { return NextResponse.json({error:(e instanceof RuleError || e instanceof LifecycleError)?e.message:e instanceof ZodError?'Check the name, question, date, and points you entered.':'Unable to save. Please try again.'},{status:400,headers:cors}); }
}
