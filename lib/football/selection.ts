// Which matches a football week features. Deterministic and explainable: every pick carries a reason players can read.
//
// A football week runs Thursday 12:00 to the next Thursday (lib/football/rules.ts period()):
//   League block (up to 5): your favourite clubs' league games first (in Türkiye: Fenerbahçe, Galatasaray, Beşiktaş),
//     then the best games from the Premier League, La Liga, Serie A and Bundesliga, one per league before any league
//     gets a second, then the best of the rest.
//   Europe block (up to 5): favourite clubs in the Champions League, Europa League or Conference League first,
//     then the biggest Champions League games, then Europa League if the Champions League isn't on.
// Match of the week (exact score + over/under) is the biggest game of all picks.
import {leagueProfile,TOP_LEAGUES,UEFA} from '../locale';
import {importance,type Fixture} from './rules';

export const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ı/g,'i').toLowerCase();

/** Club strength for European nights, from recent UEFA coefficients and title runs. Normalized substrings. Review each summer. */
const ELITE=['real madrid','barcelona','manchester city','liverpool','arsenal','bayern','paris saint germain','inter'];
const STRONG=['chelsea','manchester united','tottenham','newcastle','aston villa','atletico madrid','dortmund','leverkusen','juventus','ac milan','napoli','atalanta','roma','lazio','leipzig','benfica','porto','sporting','psv','ajax','feyenoord','celtic','monaco','marseille','lille','club brugge','galatasaray','fenerbahce','besiktas'];
const tier=(team:string)=>{const t=norm(team);return ELITE.some(c=>t.includes(c))?'elite':STRONG.some(c=>t.includes(c))?'strong':'other'};
const TIER_POINTS={elite:40,strong:22,other:8};
const COMPETITION:Record<number,{points:number;short:string}>={2:{points:25,short:'Champions League'},3:{points:0,short:'Europa League'},848:{points:-10,short:'Conference League'}};

/** Knockout rounds matter more: a final beats a quarter-final beats a group game. */
export function stagePoints(round?:string|null){const r=(round||'').toLowerCase();return /^final|\bfinal$/.test(r)&&!/semi|quarter|1\/|8th/.test(r)?60:/semi/.test(r)?45:/quarter/.test(r)?35:/round of 16|8th|1\/8/.test(r)?25:/play-?off|knockout/.test(r)?15:0}
const stageName=(round?:string|null)=>{const p=stagePoints(round);return p===60?'Final':p===45?'Semi-final':p===35?'Quarter-final':p===25?'Round of 16':p===15?'Knockout play-off':''};

export type Pick={fixture:Fixture;reason:string;score:number;headline:number;block:'league'|'europe'};

/** How many of the group's favourite clubs play: a derby between two of them is the biggest game of the week. */
function favouriteCount(f:Fixture,favourites:string[]){const h=norm(f.home),a=norm(f.away);return (favourites.some(c=>h.includes(c))?1:0)+(favourites.some(c=>a.includes(c))?1:0)}
function favouriteIn(f:Fixture,favourites:string[]){const h=norm(f.home),a=norm(f.away);if(favourites.some(c=>h.includes(c)))return f.home;if(favourites.some(c=>a.includes(c)))return f.away;return null}

/** How big a European game is. */
export function europeScore(f:Fixture,favourites:string[]=[]){
 const th=tier(f.home),ta=tier(f.away),comp=COMPETITION[f.league_id]||{points:0,short:f.league_name},stage=stagePoints((f as Fixture&{round_name?:string|null}).round_name);
 const heavy=th==='elite'&&ta==='elite',fav=favouriteIn(f,favourites);
 const table=f.home_rank&&f.away_rank&&f.home_rank<=8&&f.away_rank<=8?10:0;
 const headline=TIER_POINTS[th]+TIER_POINTS[ta]+(heavy?30:0)+comp.points+stage+table+40*favouriteCount(f,favourites);
 const stageLabel=stageName((f as Fixture&{round_name?:string|null}).round_name);
 const reason=fav?fav+' in the '+comp.short:heavy?'Heavyweight clash'+(stageLabel?' · '+stageLabel:''):stageLabel?comp.short+' '+stageLabel.toLowerCase():th!=='other'&&ta!=='other'?'Big '+comp.short+' night':comp.short;
 return{score:headline+(fav?500:0),headline,reason};
}
/** How big a league game is: derbies, big clubs, the top of the table; favourite clubs always first. */
export function leagueScore(f:Fixture,favourites:string[]=[]){
 const base=importance(f),fav=favouriteIn(f,favourites);
 const derby=!!leagueProfile(f.league_id)?.derbies.some(d=>d.name===base.reason);
 const reason=derby?base.reason:fav?fav+' plays':['Major club meeting','Top-four meeting'].includes(base.reason)?base.reason:'Best of the '+f.league_name;
 return{score:base.score+(fav?500:0),headline:base.score+40*favouriteCount(f,favourites),reason};
}

const byScore=(a:Pick,b:Pick)=>b.score-a.score||a.fixture.kickoff.localeCompare(b.fixture.kickoff)||a.fixture.id.localeCompare(b.fixture.id);

/** The week's featured matches, in kickoff order, and which one is match of the week. */
export function selectWeek(fixtures:Fixture[],favourites:string[]=[],limits={league:5,europe:5}){
 const europe:Pick[]=[],league:Pick[]=[];
 for(const f of fixtures){if(UEFA.includes(f.league_id)){const s=europeScore(f,favourites);europe.push({fixture:f,...s,block:'europe'})}else{const s=leagueScore(f,favourites);league.push({fixture:f,...s,block:'league'})}}
 // League block: favourites, then one per top league, then one per any league, then the best of what's left.
 const chosen:Pick[]=[],taken=new Set<string>();const add=(p:Pick)=>{chosen.push(p);taken.add(p.fixture.id)};
 const sorted=league.sort(byScore),leagueCount=(id:number)=>chosen.filter(p=>p.block==='league'&&p.fixture.league_id===id).length,inLeague=()=>chosen.filter(p=>p.block==='league').length;
 for(const p of sorted)if(p.score>=500&&inLeague()<limits.league)add(p);
 for(const pass of [(p:Pick)=>TOP_LEAGUES.includes(p.fixture.league_id)&&leagueCount(p.fixture.league_id)===0,(p:Pick)=>leagueCount(p.fixture.league_id)===0,()=>true])
  for(const p of sorted)if(!taken.has(p.fixture.id)&&inLeague()<limits.league&&pass(p))add(p);
 // Europe block: favourites, then the biggest nights.
 for(const p of europe.sort(byScore))if(chosen.filter(x=>x.block==='europe').length<limits.europe)add(p);
 const motw=[...chosen].sort((a,b)=>b.headline-a.headline||a.fixture.kickoff.localeCompare(b.fixture.kickoff))[0];
 return{picks:chosen.sort((a,b)=>a.fixture.kickoff.localeCompare(b.fixture.kickoff)||a.fixture.id.localeCompare(b.fixture.id)),motw};
}
/** Favourite clubs for a group, from its home league(s). */
export function favouritesFor(leagues:number[]){return [...new Set(leagues.flatMap(id=>leagueProfile(id)?.favourites||[]))]}
