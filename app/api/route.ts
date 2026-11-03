import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { execute, view, betPreview, RuleError } from '../../lib/service';
import { ZodError } from 'zod';
import { LifecycleError } from '../../lib/lifecycle';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    const invite=req.nextUrl.searchParams.get('invite')||'',question=req.nextUrl.searchParams.get('question');
    const result=await view(invite,(await cookies()).get('prediction_session')?.value,req.nextUrl.searchParams.get('round')||undefined);
    const preview=question&&!result.joined?await betPreview(invite,question):null;
    return NextResponse.json({...result,preview},{headers:{'Cache-Control':'no-store'}});
  }
  catch(e){ return NextResponse.json({error:(e instanceof RuleError || e instanceof LifecycleError)?e.message:'Unable to load group.'},{status:400}); }
}
export async function POST(req:NextRequest) {
  try {
    const origin=req.headers.get('origin');
    if(!origin || new URL(origin).host!==req.headers.get('host')) return NextResponse.json({error:'Invalid request origin.'},{status:403});
    const result=await execute(await req.json(),(await cookies()).get('prediction_session')?.value);
    const {session,...body}=result;
    const response=NextResponse.json(body);
    if(session) response.cookies.set('prediction_session',session,{httpOnly:true,secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*90});
    return response;
  } catch(e) { return NextResponse.json({error:(e instanceof RuleError || e instanceof LifecycleError)?e.message:e instanceof ZodError?'Check the name, question, date, and points you entered.':'Unable to save. Please try again.'},{status:400}); }
}
