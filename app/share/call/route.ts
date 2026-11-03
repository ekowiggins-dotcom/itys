import {NextRequest} from 'next/server';import {shareResponse} from '../../../lib/share-response';
export const runtime='nodejs';export async function GET(req:NextRequest){return shareResponse(req)}
