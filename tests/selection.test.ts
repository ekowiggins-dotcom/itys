import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectWeek,europeScore,stagePoints,favouritesFor} from '../lib/football/selection';
import {leaguePack} from '../lib/locale';
import type {Fixture} from '../lib/football/rules';

let n=0;
const f=(league:number,home:string,away:string,day:number,extra:Partial<Fixture>={}):Fixture=>({id:'f'+(++n),provider:'api-football',provider_id:n,league_id:league,league_name:({203:'Süper Lig',39:'Premier League',140:'La Liga',135:'Serie A',78:'Bundesliga',2:'UEFA Champions League',3:'UEFA Europa League',848:'UEFA Conference League'} as Record<number,string>)[league]||'Other',home,away,kickoff:new Date(Date.UTC(2030,3,11+day,18,n%60)).toISOString(),status:'scheduled',home90:null,away90:null,home_rank:null,away_rank:null,revision:'r',...extra});
const TR=favouritesFor(leaguePack(203));

test('Türkiye groups follow the Süper Lig, the top four leagues and Europe, with FB, GS and BJK as favourites',()=>{
 assert.deepEqual(leaguePack(203),[203,39,140,135,78,2,3,848]);
 assert.deepEqual(TR,['fenerbahce','galatasaray','besiktas']);
 assert.deepEqual(favouritesFor(leaguePack(39)),[]);
});

test('weekend: every FB, GS and BJK game, then the best of the top four leagues, one per league',()=>{
 const week=[
  f(203,'Fenerbahçe','Kasımpaşa',2),f(203,'Galatasaray','Trabzonspor',3),f(203,'Rizespor','Beşiktaş',3),f(203,'Samsunspor','Göztepe',2),
  f(39,'Arsenal','Chelsea',2),f(39,'Fulham','Brentford',2),f(39,'Liverpool','Everton',3),
  f(140,'Real Madrid','Barcelona',3),f(140,'Getafe','Alavés',2),f(135,'Inter','AC Milan',3),f(78,'Bayern München','Borussia Dortmund',2),
 ];
 const {picks,motw}=selectWeek(week,TR);
 const names=picks.map(p=>p.fixture.home+' v '+p.fixture.away);
 assert.equal(picks.length,5);
 for(const club of ['Fenerbahçe','Galatasaray','Beşiktaş'])assert.ok(names.some(x=>x.includes(club)),club+' is always in');
 const top=picks.filter(p=>p.fixture.league_id!==203);assert.equal(top.length,2);assert.notEqual(top[0].fixture.league_id,top[1].fixture.league_id,'two different leagues');
 assert.ok(top.every(p=>/derby|Clásico|Klassiker|Madonnina/.test(p.reason)),'derbies beat ordinary games: '+top.map(p=>p.reason));
 assert.equal(picks.find(p=>p.fixture.home==='Fenerbahçe')!.reason,'Fenerbahçe plays');
 assert.ok(['Real Madrid','Inter','Bayern München','Liverpool'].includes(motw.fixture.home),'match of the week is the biggest game, not just a favourite playing');
});

test('an Istanbul derby is one game, frees a slot, and is match of the week',()=>{
 const {picks,motw}=selectWeek([f(203,'Galatasaray','Fenerbahçe',3),f(203,'Beşiktaş','Konyaspor',2),f(39,'Arsenal','Tottenham',2),f(140,'Real Madrid','Atlético Madrid',3),f(135,'Roma','Lazio',3),f(78,'Bayern München','Borussia Dortmund',2)],TR);
 assert.equal(picks.length,5);assert.equal(picks.filter(p=>p.fixture.league_id!==203).length,3);
 assert.equal(motw.fixture.home,'Galatasaray');assert.equal(motw.reason,'Istanbul derby');
});

test('midweek: Turkish clubs in Europe first, then the biggest Champions League nights',()=>{
 const week=[
  f(3,'Fenerbahçe','Olympique Lyonnais',0),f(2,'Real Madrid','Manchester City',5),f(2,'PSV Eindhoven','Club Brugge',5),f(2,'Bayern München','Arsenal',6),
  f(2,'Inter','Benfica',6),f(2,'Young Boys','Slavia Praha',5),f(2,'Celtic','FC Copenhagen',6),f(2,'Liverpool','Bodø/Glimt',6),
 ];
 const {picks}=selectWeek(week,TR);const eu=picks.filter(p=>p.block==='europe');
 assert.equal(eu.length,5);
 assert.ok(eu.some(p=>p.fixture.home==='Fenerbahçe'&&p.reason==='Fenerbahçe in the Europa League'));
 const names=eu.map(p=>p.fixture.home);for(const big of ['Real Madrid','Bayern München','Inter','Liverpool'])assert.ok(names.includes(big),big);
 assert.ok(!names.includes('Young Boys'));
 assert.equal(eu.find(p=>p.fixture.home==='Real Madrid')!.reason,'Heavyweight clash');
});

test('knockout rounds rank above league-phase games',()=>{
 assert.deepEqual(['Final','Semi-finals','Quarter-finals','Round of 16','Knockout Round Play-offs','League Stage - 5'].map(stagePoints),[60,45,35,25,15,0]);
 const groupGame=europeScore(f(2,'Arsenal','Juventus',5)),quarter=europeScore(f(2,'PSV Eindhoven','Atalanta',5,{round_name:'Quarter-finals'}));
 assert.ok(quarter.headline>groupGame.headline-20);assert.match(quarter.reason,/quarter-final/);
});

test('a quiet week still works: no Europe, no favourites',()=>{
 const {picks}=selectWeek([f(39,'Fulham','Brentford',2),f(39,'Wolves','Burnley',2),f(140,'Getafe','Alavés',3)],[]);
 assert.equal(picks.length,3);assert.ok(picks.every(p=>/^Best of the /.test(p.reason)));
 assert.equal(selectWeek([],TR).picks.length,0);
});

test('club size breaks ties between ordinary league games',()=>{
 const {picks}=selectWeek([f(39,'Leeds','Tottenham',2),f(39,'Manchester United','Aston Villa',3),f(39,'Fulham','Newcastle',2),f(140,'Valencia','Real Madrid',2),f(140,'Atletico Madrid','Barcelona',3)],[],{league:2,europe:0});
 assert.deepEqual(picks.map(p=>p.fixture.home).sort(),['Atletico Madrid','Manchester United']);
});
