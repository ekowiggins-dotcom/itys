import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'manual-'));process.env.PREDICTION_DATA_DIR=dir;process.env.FOOTBALL_FEED='manual';process.env.API_FOOTBALL_KEY='';
const {db}=await import('../lib/db');const {execute,view}=await import('../lib/service');const {runScheduler}=await import('../lib/scheduler');
const {parseMatches,addMatches,publishWeek,setResult}=await import('../lib/football/manual');
after(async()=>{await(await db()).close();await rm(dir,{recursive:true,force:true})});

test('match lines parse in Istanbul time and report mistakes by line',()=>{
 const {fixtures,errors}=parseMatches('# comment\n2030-04-13 20:00 | SL | Galatasaray | Fenerbahçe | Round 30\n2030-04-13 19:30 | epl | Arsenal | Chelsea\nnonsense\n2030-04-13 19:30 | XYZ | A | B');
 assert.equal(fixtures.length,2);assert.equal(fixtures[0].kickoff,'2030-04-13T17:00:00.000Z');assert.equal(fixtures[0].league_id,203);assert.equal(fixtures[0].round_name,'Round 30');assert.equal(fixtures[1].league_id,39);
 assert.equal(errors.length,2);assert.match(errors[0],/^Line 4/);assert.match(errors[1],/unknown league/);
 assert.equal(parseMatches('2030-04-13 21:00 | SL | Galatasaray | Fenerbahçe').fixtures[0].id,fixtures[0].id,'same match, same day: a corrected time updates it');
});

test('a published manual week opens with the rules’ picks and settles from entered scores',async()=>{
 const base=new Date('2030-04-08T09:00:00Z'),open=new Date('2030-04-11T09:00:00Z');
 const a=await execute({action:'create',name:'Arda',groupName:'Matchday',groupType:'Football',timezone:'Europe/Istanbul'},undefined,base),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Ege'},undefined,base);await execute({action:'join',invite,name:'Can'},undefined,base);
 const lines=['2030-04-12 20:00 | SL | Fenerbahçe | Kasımpaşa','2030-04-13 20:00 | SL | Galatasaray | Trabzonspor','2030-04-13 17:00 | SL | Rizespor | Beşiktaş','2030-04-12 17:00 | SL | Samsunspor | Göztepe',
  '2030-04-13 18:30 | EPL | Liverpool | Everton','2030-04-13 16:00 | EPL | Fulham | Brentford','2030-04-13 22:00 | LALIGA | Real Madrid | Barcelona','2030-04-12 21:45 | SERIEA | Inter | AC Milan',
  '2030-04-15 22:00 | UCL | Real Madrid | Manchester City | Quarter-finals','2030-04-16 22:00 | UCL | Bayern München | Arsenal | Quarter-finals'];
 const {fixtures,errors}=parseMatches(lines.join('\n'));assert.deepEqual(errors,[]);
 await addMatches(fixtures,base);
 await runScheduler(open);assert.equal((await view(invite,a.session,undefined,open)).selectedRound?.state,'waiting_feed','nothing opens before the week is published');
 await publishWeek(open);await runScheduler(open);
 const v=await view(invite,a.session,undefined,open);assert.equal(v.selectedRound?.state,'live');
 const featured=(v.questions as unknown as {id:string;text:string;market:string}[]).filter(q=>q.market==='result');
 assert.equal(featured.length,7,'5 league games + 2 Champions League games');
 for(const club of ['Fenerbahçe','Galatasaray','Beşiktaş'])assert.ok(featured.some(q=>q.text.includes(club)),club);
 assert.ok(!featured.some(q=>q.text.includes('Fulham')));
 const fb=featured.find(q=>q.text.startsWith('Fenerbahçe'))!;
 await execute({action:'predict',invite,questionId:fb.id,answer:'home',stake:20},b.session,open);
 const after=new Date('2030-04-12T19:30:00Z');
 await setResult(fixtures[0].id,{home:3,away:1},after);await runScheduler(after);
 const score=(await(await db()).query<{points_tenths:number}>('SELECT points_tenths FROM scores WHERE question_id=$1',[fb.id])).rows[0];
 assert.ok(score&&score.points_tenths>0,'the right pick scored from the entered result');
 await setResult(fixtures[1].id,'void',after);await runScheduler(after);
 assert.equal((await(await db()).query<{state:string}>("SELECT state FROM questions WHERE fixture_id=$1 AND market='result'",[fixtures[1].id])).rows[0].state,'void');
});

test('a new football group starts picking straight away with a starter week, then joins the Thursday rhythm',async()=>{
 const tue=new Date('2030-05-07T08:00:00Z'); // Tuesday 11:00 in Istanbul
 const {fixtures}=parseMatches('2030-05-07 22:00 | UCL | Real Madrid | Manchester City | Semi-finals\n2030-05-08 22:00 | UCL | Bayern München | Arsenal | Semi-finals\n2030-05-11 20:00 | SL | Galatasaray | Fenerbahçe');
 await addMatches(fixtures,tue);await publishWeek(tue);
 const a=await execute({action:'create',name:'Arda',groupName:'New crew',groupType:'Mixed',timezone:'Europe/Istanbul'},undefined,tue),invite=a.invite!;
 for(const n of ['Ege','Can'])await execute({action:'join',invite,name:n},undefined,tue);
 await runScheduler(tue);
 const v=await view(invite,a.session,undefined,tue);
 assert.equal(v.selectedRound?.state,'live','no waiting for Thursday');
 const texts=(v.questions as unknown as {text:string;market:string}[]).filter(q=>q.market==='result').map(q=>q.text);
 assert.equal(texts.length,2,'the starter week has this week’s remaining matches');assert.ok(!texts.some(t=>t.includes('Galatasaray')),'Saturday belongs to the next week');
 assert.equal(new Date(v.selectedRound!.deadline_at).getTime()>tue.getTime(),true);
 const thu=new Date('2030-05-09T09:00:00Z');await publishWeek(thu);await runScheduler(thu);
 const next=await view(invite,a.session,undefined,thu);assert.equal(new Date(next.selectedRound!.opens_at).toISOString(),thu.toISOString(),'next week opens Thursday 12:00');
 assert.ok((next.questions as unknown as {text:string}[]).some(q=>q.text.includes('Galatasaray')));
});

test('next week shows as soon as it is published, and Saturday noon nudges people with weekend picks left',async()=>{
 const thu=new Date('2030-06-06T09:00:00Z'),mon=new Date('2030-06-10T07:00:00Z'),sat=new Date('2030-06-08T09:05:00Z');
 const {fixtures}=parseMatches('2030-06-08 19:00 | SL | Galatasaray | Konyaspor\n2030-06-09 20:00 | SL | Fenerbahçe | Rizespor\n2030-06-14 20:00 | SL | Beşiktaş | Trabzonspor');
 await addMatches(fixtures,new Date('2030-06-04T09:00:00Z'));await publishWeek(new Date('2030-06-05T09:00:00Z'));
 const a=await execute({action:'create',name:'Arda',groupName:'Weekenders',groupType:'Football',timezone:'Europe/Istanbul'},undefined,new Date('2030-06-05T12:00:00Z')),invite=a.invite!;
 const b=await execute({action:'join',invite,name:'Ege'},undefined,new Date('2030-06-05T12:00:00Z'));await execute({action:'join',invite,name:'Can'},undefined,new Date('2030-06-05T12:00:00Z'));
 await runScheduler(thu);const v=await view(invite,a.session,undefined,thu);assert.equal(v.selectedRound?.state,'live');
 const gs=(v.questions as unknown as {id:string;text:string;market:string}[]).find(q=>q.market==='result'&&q.text.startsWith('Galatasaray'))!;
 await execute({action:'predict',invite,questionId:gs.id,answer:'home',stake:20},b.session,thu);
 await runScheduler(sat);const d=await db();
 const nudges=(await d.query<{user_id:string;text:string}>("SELECT n.user_id,n.text FROM notifications n JOIN groups g ON g.id=n.group_id WHERE g.invite=$1 AND n.source_key LIKE '%:saturday'",[invite])).rows;
 assert.equal(nudges.length,3,'everyone with a weekend pick left');assert.match(nudges[0].text,/^Weekend matches: \d picks? left\. First kickoff \d\d:\d\d\.$/);
 const left=(text:string)=>Number(text.match(/: (\d+)/)![1]);const counts=nudges.map(n=>left(n.text)).sort();assert.ok(counts[0]<counts[2],'Ege picked one, so has fewer left: '+counts);
 await publishWeek(mon);const later=await view(invite,a.session,undefined,mon) as unknown as {comingUp:{matches:{home:string}[]}|null};
 assert.ok(later.comingUp?.matches.some(m=>m.home==='Beşiktaş'),'next week is visible as soon as it’s published');
});
