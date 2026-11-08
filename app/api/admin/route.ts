import {NextRequest,NextResponse} from 'next/server';import {timingSafeEqual,createHash} from 'node:crypto';import {z} from 'zod';
import {parseMatches,addMatches,publishWeek,setResult,listMatches,manualMode} from '../../../lib/football/manual';
import {metrics} from '../../../lib/metrics';
import {selectWeek,favouritesFor} from '../../../lib/football/selection';import {leaguePack} from '../../../lib/locale';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Operator tools for the manual match list. Protected by ADMIN_KEY (Railway variable); never reachable without it.
// None of these can move points between people: they record which real matches exist and their real final scores.
function allowed(req:NextRequest){const key=process.env.ADMIN_KEY||'',given=req.headers.get('x-admin-key')||'';if(key.length<12)return false;const a=createHash('sha256').update(key).digest(),b=createHash('sha256').update(given).digest();return timingSafeEqual(a,b)}
const deny=()=>NextResponse.json({error:'Wrong admin key, or ADMIN_KEY (12+ characters) isn’t set in Railway.'},{status:401});
async function state(){const now=new Date();const matches=await listMatches(now);const upcoming=matches.filter(f=>f.status==='scheduled'&&Date.parse(f.kickoff)>now.getTime());const {picks,motw}=selectWeek(upcoming,favouritesFor(leaguePack(203)));
 return{manual:manualMode(),matches,preview:picks.map(p=>({id:p.fixture.id,reason:p.reason,block:p.block,motw:p.fixture.id===motw?.fixture.id}))}}
export async function GET(req:NextRequest){if(!allowed(req))return deny();if(req.nextUrl.searchParams.get('metrics')!==null)return NextResponse.json(await metrics(),{headers:{'Cache-Control':'no-store'}});return NextResponse.json(await state(),{headers:{'Cache-Control':'no-store'}})}
const body=z.discriminatedUnion('action',[
 z.object({action:z.literal('adminAddMatches'),text:z.string().max(20000),zone:z.string().max(60).optional()}),
 z.object({action:z.literal('adminPublishWeek')}),
 z.object({action:z.literal('adminResult'),id:z.string().max(80),home:z.number().int().min(0).max(30),away:z.number().int().min(0).max(30)}),
 z.object({action:z.literal('adminVoid'),id:z.string().max(80)}),
]);
export async function POST(req:NextRequest){
 if(!allowed(req))return deny();
 try{const data=body.parse(await req.json());
  if(data.action==='adminAddMatches'){const {fixtures,errors}=parseMatches(data.text,data.zone);if(errors.length)return NextResponse.json({error:errors.join('\n')},{status:400});await addMatches(fixtures);return NextResponse.json({added:fixtures.length,...await state()})}
  if(data.action==='adminPublishWeek'){const r=await publishWeek();return NextResponse.json({published:r,...await state()})}
  await setResult(data.id,data.action==='adminVoid'?'void':{home:data.home,away:data.away});return NextResponse.json(await state());
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?'Check the scores and fields.':(e as Error).message},{status:400})}
}
