// Manual match list for the MVP: the operator pastes the week's candidate matches and enters final scores on /admin.
// The selection rules (selection.ts) then pick the featured matches exactly as they would from the live feed.
// Turned on with FOOTBALL_FEED=manual. Manual fixtures settle through the same path as feed results.
import {createHash} from 'node:crypto';
import {db} from '../db';
import {ingest} from './store';
import {localDate,type Fixture} from './rules';
import {LEAGUES,leaguePack} from '../locale';

export const manualMode=(env:Record<string,string|undefined>=process.env)=>env.FOOTBALL_FEED==='manual';
export const LEAGUE_CODES:Record<string,number>={SL:203,TR:203,EPL:39,PL:39,LALIGA:140,LIGA:140,SERIEA:135,SA:135,BUNDES:78,BL:78,UCL:2,CL:2,UEL:3,EL:3,UECL:848,ECL:848,L1:61};
const DAY=86400000;

/** One match per line: `2026-11-08 20:00 | SL | Galatasaray | Fenerbahçe | Round 11` (time in the given zone; round optional). */
export function parseMatches(text:string,zone='Europe/Istanbul'){
 const fixtures:Fixture[]=[],errors:string[]=[];
 text.split(/\r?\n/).forEach((raw,i)=>{const line=raw.trim();if(!line||line.startsWith('#'))return;
  const parts=line.split(/\s*[|;]\s*/);const where='Line '+(i+1)+': ';
  if(parts.length<4){errors.push(where+'use  date time | league | home | away');return}
  const m=parts[0].match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);if(!m){errors.push(where+'date must look like 2026-11-08 20:00');return}
  const code=parts[1].toUpperCase().replace(/[^A-Z0-9]/g,''),league=LEAGUE_CODES[code]??(Number(code)||0);if(!LEAGUES[league]){errors.push(where+'unknown league "'+parts[1]+'" (use '+Object.keys(LEAGUE_CODES).join(', ')+')');return}
  const home=parts[2].slice(0,100),away=parts[3].slice(0,100);if(!home||!away||home===away){errors.push(where+'two different teams needed');return}
  const kickoff=localDate(+m[1],+m[2],+m[3],+m[4],+m[5],zone).toISOString();
  // Same teams, league and day = same match, so pasting a corrected line updates it instead of adding a copy.
  const key=[league,home.toLowerCase(),away.toLowerCase(),m[1]+m[2]+m[3]].join('|');const providerId=parseInt(createHash('sha256').update(key).digest('hex').slice(0,7),16)+1;
  const f:Fixture={id:'manual:'+providerId,provider:'manual',provider_id:providerId,league_id:league,league_name:LEAGUES[league].name,home,away,kickoff,status:'scheduled',home90:null,away90:null,home_rank:null,away_rank:null,round_name:parts[4]?.slice(0,100)||null,revision:''};
  f.revision=JSON.stringify([f.kickoff,f.status,null,null]);fixtures.push(f);
 });
 return{fixtures,errors};
}

export async function addMatches(fixtures:Fixture[],now=new Date()){const d=await db();await d.transaction(tx=>ingest(tx,fixtures,now));return fixtures.length}

/** Tells the rounds the match list for the coming days is complete, so the next football week can open with it.
 * Covers the past 8 days (so a week that's already running is covered) to 10 days ahead, for every league groups follow. */
export async function publishWeek(now=new Date()){
 const d=await db();const from=new Date(now.getTime()-8*DAY),to=new Date(now.getTime()+10*DAY);
 const leagues=new Set<number>([...leaguePack(203),...Object.values(LEAGUE_CODES)]);
 for(const row of (await d.query<{leagues:number[]}>('SELECT leagues FROM groups')).rows)for(const id of row.leagues)leagues.add(id);
 // fetched_at = the window's end: a manual list stays "fresh" for the whole window it covers.
 await d.transaction(async tx=>{for(const id of leagues)await tx.query('INSERT INTO football_feed_windows VALUES($1,$2,$3,$4) ON CONFLICT(league_id,from_at,to_at) DO UPDATE SET fetched_at=EXCLUDED.fetched_at',[id,from,to,to]);
  await tx.query("INSERT INTO football_feed_status(id,last_success,error) VALUES('api-football',$1,NULL) ON CONFLICT(id) DO UPDATE SET last_success=$1,error=NULL",[now])});
 return{from,to,leagues:leagues.size};
}

/** Final 90-minute score, or postponed/cancelled (void: everyone gets their points back). Manual matches only. */
export async function setResult(id:string,result:{home:number;away:number}|'void',now=new Date()){
 const d=await db();const f=(await d.query<Fixture>("SELECT * FROM football_fixtures WHERE id=$1 AND provider='manual'",[id])).rows[0];if(!f)throw new Error('Match not found.');
 const next:Fixture={...f,kickoff:new Date(f.kickoff).toISOString(),...(result==='void'?{status:'void',home90:null,away90:null}:{status:'finished',home90:result.home,away90:result.away})};
 next.revision=JSON.stringify([next.kickoff,next.status,next.home90,next.away90]);
 await d.transaction(tx=>ingest(tx,[next],now));return next;
}

export async function listMatches(now=new Date()){
 const d=await db();
 return (await d.query<Fixture&{featured:number}>("SELECT f.*,(SELECT count(*)::int FROM questions q WHERE q.fixture_id=f.id AND NOT q.superseded) featured FROM football_fixtures f WHERE f.kickoff BETWEEN $1 AND $2 ORDER BY f.kickoff,f.league_id",[new Date(now.getTime()-4*DAY),new Date(now.getTime()+14*DAY)])).rows.map(f=>({...f,kickoff:new Date(f.kickoff).toISOString()}));
}
