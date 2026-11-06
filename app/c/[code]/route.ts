import {NextRequest} from 'next/server';import {resolveCode} from '../../../lib/short-links';import {sharePage} from '../../../lib/share-response';
export const runtime='nodejs';
// Short share link: calld.app/c/<code>. Shows a rich preview in chat apps, then opens the call.
export async function GET(req:NextRequest,{params}:{params:Promise<{code:string}>}){
 const {code}=await params;const target=await resolveCode(code);
 if(!target)return new Response('This link has expired or never existed.',{status:404,headers:{'Cache-Control':'no-store'}});
 const forName=req.nextUrl.searchParams.get('for')?.slice(0,60)||undefined,reveal=req.nextUrl.searchParams.get('r')==='1';
 return sharePage(req,{...target,forName,reveal},'/share/image?c='+encodeURIComponent(code)+(forName?'&for='+encodeURIComponent(forName):'')+(reveal?'&r=1':''));
}
