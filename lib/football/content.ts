import {randomUUID} from 'node:crypto';import type {Transaction} from '@electric-sql/pglite';import {type Fixture,type GroupType,type Market} from './rules';import {selectWeek,favouritesFor} from './selection';import {coverage} from './store';
export type FootballRound={id:string;group_id:string;group_type:GroupType;timezone:string;leagues:number[];opens_at:Date;fixture_end_at:Date;content_ready:boolean;state:string};
export async function addMarkets(tx:Transaction,r:FootballRound,f:Fixture,slot:string,creator:string,markets:Market[],reason:string){for(const market of markets){const suffix=market==='result'?'Match result':market==='exact_score'?'Exact score':'Over / under 2.5 goals';await tx.query('INSERT INTO questions(id,group_id,creator,text,locks_at,event_at,round_id,market,fixture_id,slot,selection_reason) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10)',[randomUUID(),r.group_id,creator,f.home+' vs '+f.away+' · '+suffix,f.kickoff,r.id,market,f.id,slot,reason])}}
export async function materialize(tx:Transaction,r:FootballRound,now:Date){if(r.group_type==='Friends'||r.content_ready||['final','skipped','planned'].includes(r.state))return;
 const complete=await coverage(tx,r.leagues,new Date(r.opens_at),new Date(r.fixture_end_at),now);if(!complete)return;
 const all=(await tx.query<Fixture>('SELECT * FROM football_fixtures WHERE league_id=ANY($1::int[]) AND kickoff>=$2 AND kickoff<$3',[r.leagues,r.opens_at,r.fixture_end_at])).rows.map(f=>({...f,kickoff:new Date(f.kickoff).toISOString()}));
 const playing=all.filter(f=>!['void','unknown'].includes(f.status));
 if(!playing.length){if(all.some(f=>f.status==='unknown'))return;await tx.query("UPDATE rounds SET state='skipped',skip_reason='No league games',finalized_at=$2 WHERE id=$1",[r.id,now]);await tx.query('INSERT INTO football_skipped_weeks VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[r.group_id,r.opens_at,'No league games']);return;}
 const {picks,motw}=selectWeek(playing.filter(f=>f.status==='scheduled'&&new Date(f.kickoff)>now),favouritesFor(r.leagues));
 if(!picks.length){await tx.query("UPDATE rounds SET state='skipped',skip_reason='Feed arrived after all kickoffs',finalized_at=$2 WHERE id=$1",[r.id,now]);return;}
 const admin=(await tx.query<{admin:string}>('SELECT admin FROM groups WHERE id=$1',[r.group_id])).rows[0].admin;
 for(const p of picks)await addMarkets(tx,r,p.fixture,'featured',admin,['result'],p.reason);
 await tx.query("UPDATE rounds SET content_ready=true,state='live' WHERE id=$1",[r.id]);
}
