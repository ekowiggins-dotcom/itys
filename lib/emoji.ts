// Emoji on share cards. Satori can't draw colour emoji fonts, so each emoji is swapped for its Twemoji picture
// (CC-BY 4.0, from the @twemoji/svg package, bundled; no network).
import {readFile} from 'node:fs/promises';import path from 'node:path';
const cache=new Map<string,string>();
/** Twemoji file name: code points in hex joined by "-", without the FE0F selector unless it's a ZWJ sequence. */
export function emojiFile(segment:string){const cps=[...segment].map(c=>c.codePointAt(0)!.toString(16));return (segment.includes('‍')?cps:cps.filter(c=>c!=='fe0f')).join('-')}
export async function emojiAsset(segment:string){
 const name=emojiFile(segment);if(cache.has(name))return cache.get(name)!;
 const dir=path.join(process.cwd(),'node_modules/@twemoji/svg');
 let svg='';for(const n of [name,name.replace(/-fe0f/g,'')])try{svg=await readFile(path.join(dir,n+'.svg'),'utf8');break}catch{}
 const uri=svg?'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'):'';cache.set(name,uri);return uri;
}
