import {randomUUID} from 'node:crypto';import type {Transaction} from '@electric-sql/pglite';import {db} from '../db';import {ApiFootball} from './provider';import {UEFA} from '../locale';import type {Fixture} from './rules';
export async function ingest(tx:Transaction,fixtures:Fixture[],now:Date){
 for(const f of fixtures){const old=(await tx.query<Fixture>('SELECT * FROM football_fixtures WHERE id=$1',[f.id])).rows[0];let review=!!old?.needs_review;
 if(old&&new Date(f.kickoff)<new Date(old.kickoff)&&new Date(f.kickoff)<=now){review ||= (await tx.query('SELECT 1 FROM predictions p JOIN questions q ON q.id=p.question_id WHERE q.fixture_id=$1 AND p.submitted_at>$2',[f.id,f.kickoff])).rows.length>0;}
 await tx.query(`INSERT INTO football_fixtures(id,provider,provider_id,league_id,league_name,home,away,kickoff,status,home90,away90,home_rank,away_rank,revision,observed_at,needs_review,round_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(id) DO UPDATE SET round_name=COALESCE(EXCLUDED.round_name,football_fixtures.round_name),league_name=EXCLUDED.league_name,home=EXCLUDED.home,away=EXCLUDED.away,kickoff=EXCLUDED.kickoff,status=EXCLUDED.status,home90=EXCLUDED.home90,away90=EXCLUDED.away90,home_rank=COALESCE(EXCLUDED.home_rank,football_fixtures.home_rank),away_rank=COALESCE(EXCLUDED.away_rank,football_fixtures.away_rank),revision=EXCLUDED.revision,observed_at=EXCLUDED.observed_at,needs_review=EXCLUDED.needs_review`,[f.id,f.provider,f.provider_id,f.league_id,f.league_name,f.home,f.away,f.kickoff,f.status,f.home90,f.away90,f.home_rank,f.away_rank,f.revision,now,review,f.round_name??null]);
 await tx.query('INSERT INTO football_fixture_revisions VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[randomUUID(),f.id,f.revision,JSON.stringify(f),now]);
 }
}
export async function coverage(tx:Transaction,leagues:number[],from:Date,to:Date,now:Date){for(const id of leagues){if(!(await tx.query('SELECT 1 FROM football_feed_windows WHERE league_id=$1 AND from_at<=$2 AND to_at>=$3 AND fetched_at>=$4',[id,from,to,new Date(now.getTime()-86400000)])).rows.length)return false}return true}
export async function syncLeague(id:number,now:Date){
 const d=await db(),api=new ApiFootball(process.env.API_FOOTBALL_KEY||'');
 let league=(await d.query<{id:number;name:string;country:string;season:number;checked_at:Date}>('SELECT * FROM football_leagues WHERE id=$1',[id])).rows[0];
 if(!league||now.getTime()-new Date(league.checked_at).getTime()>7*86400000){const data=await api.league(id);await d.query('INSERT INTO football_leagues VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,country=EXCLUDED.country,season=EXCLUDED.season,checked_at=EXCLUDED.checked_at',[data.id,data.name,data.country,data.season,now]);league={...data,checked_at:now}}
 const from=new Date(now.getTime()-10*86400000),to=new Date(now.getTime()+14*86400000),fixtures=await api.fixtures(id,league.season,from,to);
 // Selection works without standings; fixture availability never depends on an optional ranking endpoint.
 if(!UEFA.includes(id))try{let cached=(await d.query<{ranks:Record<string,number>;fetched_at:Date;season:number}>('SELECT ranks,fetched_at,season FROM football_rankings WHERE league_id=$1',[id])).rows[0];if(!cached||cached.season!==league.season||now.getTime()-new Date(cached.fetched_at).getTime()>86400000){const ranks=await api.ranks(id,league.season);cached={ranks:Object.fromEntries(ranks),fetched_at:now,season:league.season};await d.query('INSERT INTO football_rankings VALUES($1,$2,$3,$4) ON CONFLICT(league_id) DO UPDATE SET season=EXCLUDED.season,ranks=EXCLUDED.ranks,fetched_at=EXCLUDED.fetched_at',[id,league.season,JSON.stringify(cached.ranks),now])}for(const f of fixtures){f.home_rank=cached.ranks[f.home]||null;f.away_rank=cached.ranks[f.away]||null}}catch{}
 await d.transaction(async tx=>{await ingest(tx,fixtures,now);await tx.query('INSERT INTO football_feed_windows VALUES($1,$2,$3,$4) ON CONFLICT(league_id,from_at,to_at) DO UPDATE SET fetched_at=EXCLUDED.fetched_at',[id,from,to,now])});return fixtures.length;
}
const SCHEDULE_MS=6*3600000;
/** Fresh scores for featured matches kicking off within the hour or played in the last five hours. */
export async function syncLive(now:Date){
 const d=await db(),api=new ApiFootball(process.env.API_FOOTBALL_KEY||'');
 const ids=(await d.query<{provider_id:number}>("SELECT DISTINCT f.provider_id FROM football_fixtures f JOIN questions q ON q.fixture_id=f.id JOIN rounds r ON r.id=q.round_id WHERE r.state NOT IN ('final','skipped') AND NOT q.superseded AND f.kickoff BETWEEN $1 AND $2 AND f.status IN ('scheduled','live','unknown') ORDER BY 1",[new Date(now.getTime()-5*3600000),new Date(now.getTime()+3600000)])).rows.map(r=>r.provider_id);
 for(let i=0;i<ids.length;i+=20){const fixtures=await api.byIds(ids.slice(i,i+20));await d.transaction(tx=>ingest(tx,fixtures,now))}
 return ids.length;
}
export async function syncFootball(now=new Date()){
 const d=await db();const rows=(await d.query<{leagues:number[];pending_settings:{leagues?:number[];groupType?:string}|null}>("SELECT leagues,pending_settings FROM groups WHERE group_type IN ('Football','Mixed') OR pending_settings->>'groupType' IN ('Football','Mixed')")).rows;
 if(!rows.length)return{connected:!!process.env.API_FOOTBALL_KEY};
 if(!process.env.API_FOOTBALL_KEY){await d.query("INSERT INTO football_feed_status(id,error) VALUES('api-football','Provider key not configured') ON CONFLICT(id) DO UPDATE SET error=EXCLUDED.error");return{connected:false};}
 const claim=await d.query("INSERT INTO football_feed_status(id,last_attempt,next_poll) VALUES('api-football',$1,$2) ON CONFLICT(id) DO UPDATE SET last_attempt=$1,next_poll=$2 WHERE football_feed_status.next_poll IS NULL OR football_feed_status.next_poll<=$1 RETURNING id",[now,new Date(now.getTime()+15*60000)]);if(!claim.rows.length)return{connected:true};
 try{
  // Request budget (API-Football free plan: 100 a day): each league's schedule every 6 hours, plus the featured
  // matches that are about to start or are being played, by id, on every 15-minute sweep.
  for(const id of new Set(rows.flatMap(r=>[...r.leagues,...(r.pending_settings?.leagues||[])]))){const last=(await d.query<{at:Date|null}>('SELECT max(fetched_at) at FROM football_feed_windows WHERE league_id=$1',[id])).rows[0]?.at;if(!last||now.getTime()-new Date(last).getTime()>=SCHEDULE_MS)await syncLeague(id,now)}
  await syncLive(now);await d.query("UPDATE football_feed_status SET last_success=$1,error=NULL WHERE id='api-football'",[now]);return{connected:true}}catch{await d.query("UPDATE football_feed_status SET error='Feed unavailable; check current-season access, quota and provider status' WHERE id='api-football'");return{connected:true,error:true}}
}
