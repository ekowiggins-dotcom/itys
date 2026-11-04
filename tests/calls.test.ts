import {test} from 'node:test';import assert from 'node:assert/strict';
import {sortCalls,reveal,headline,potential,outcome,answersOf,label,matchTitle,type Call} from '../app/calls';
import {whenChoices,laterMonths} from '../app/when-presets';
import {callOfTheWeek} from '../app/RankingTab';

const now=Date.parse('2030-04-10T09:00:00Z'),H=3600000;
const base:Call={id:'x',text:'?',scope:'weekly',locks_at:new Date(now+H).toISOString(),event_at:null,state:'open',creator:'u2',creator_name:'Ege',answer:null,proposed_answer:null,proposed_at:null,points_tenths:null};
const c=(o:Partial<Call>):Call=>({...base,...o});

test('one list of calls, grouped by what you can do',()=>{
 const s=sortCalls([
  c({id:'turn'}),c({id:'in',answer:'yes',stake:20}),c({id:'about',subject_id:'me'}),
  c({id:'locked',locks_at:new Date(now-H).toISOString()}),c({id:'proposed',state:'proposed',locks_at:new Date(now-H).toISOString()}),
  c({id:'later-open',scope:'longterm',event_at:new Date(now+60*24*H).toISOString()}),
  c({id:'later-picked',scope:'longterm',answer:'no',event_at:new Date(now+60*24*H).toISOString()}),
  c({id:'later-locked',scope:'longterm',answer:'no',locks_at:new Date(now-H).toISOString(),event_at:new Date(now+60*24*H).toISOString()}),
  c({id:'done',state:'settled',result_answer:'yes'}),c({id:'match',fixture_id:'f1'}),c({id:'hidden',moderation_state:'pending'}),
 ],'me',now);
 assert.deepEqual(s.yourTurn.map(x=>x.id),['turn','later-open','match'],'a later call you haven’t picked is your turn too, and matches sit in the same list');
 assert.deepEqual(s.inIt.map(x=>x.id),['in','about']);
 assert.deepEqual(s.locked.map(x=>x.id),['locked','proposed']);
 assert.deepEqual(s.later.map(x=>x.id).sort(),['later-locked','later-picked']);
 assert.deepEqual(s.results.map(x=>x.id),['done']);assert.deepEqual(s.hidden.map(x=>x.id),['hidden']);
});

test('the reveal tells the story and the score preview matches the scoring rule',()=>{
 const call=c({options:['Emre','Aykut','Sergio','Nagelsmann']});
 const snaps=[['Ege','Nagelsmann'],['Egemen','Nagelsmann'],['Deniz','Nagelsmann'],['Can','Emre'],['Arda','Aykut']].map(([name,answer])=>({question_id:'x',name,answer,stake:20,total:5}));
 const groups=reveal(call,snaps);
 assert.deepEqual(groups.map(g=>g.names.length),[1,1,0,3]);
 assert.equal(headline(groups,'Arda'),'Three of you said Nagelsmann. Can went Emre alone.');
 assert.equal(potential({},1,5),34,'alone in 5: 10 + 30 × 4/5');
 assert.equal(outcome(c({state:'settled',answer:'Aykut',result_answer:'Aykut',points_tenths:360})).text,'You called it · +36');
 assert.equal(outcome(c({state:'void'})).tone,'void');
 const best=callOfTheWeek([c({state:'settled',result_answer:'Aykut'})],snaps);assert.equal(best?.name,'Arda');assert.equal(best?.score,34);assert.ok(best?.alone);
});

test('When will we know? turns into valid lock and event times',()=>{
 const deadline=now+5*24*H;
 const open=whenChoices(now,{practice:false,weeklyOpen:true,deadline});
 for(const ch of open.filter(x=>x.ok)){assert.ok(ch.lock>now&&(ch.id==='later'||ch.lock<=deadline),ch.id)}
 const later=open.find(x=>x.id==='later')!;assert.ok(later.event!-now>7*24*H,'later calls resolve after this week');assert.ok(later.lock<=later.event!);
 const closed=whenChoices(now,{practice:false,weeklyOpen:false,weeklyWhy:'Full',deadline});
 assert.deepEqual(closed.map(x=>x.ok),[false,false,true]);assert.equal(closed[1].why,'Full');
 assert.equal(laterMonths(now).length,6);
 const practice=whenChoices(now,{practice:true,weeklyOpen:true,deadline:now+40*60000});
 assert.ok(practice.every(x=>x.ok));assert.ok(practice[2].event!-now<=30*60000);
});

test('a match call shows the teams, not Yes / No',()=>{
 const match={home:'Fenerbahçe',away:'Liverpool'};
 const result=c({id:'r',market:'result',fixture_id:'f1',match});
 assert.deepEqual(answersOf(result).map(a=>label(a,result)),['Fenerbahçe','Draw','Liverpool']);
 assert.equal(matchTitle(result),'Fenerbahçe – Liverpool');
 const goals=c({id:'g',market:'over_under',fixture_id:'f1',match});
 assert.deepEqual(answersOf(goals).map(a=>label(a,goals)),['Over 2.5','Under 2.5']);
 const score=c({id:'s',market:'exact_score',fixture_id:'f1',match,split:{'1-1':1,'2-1':3}});
 assert.deepEqual(answersOf(score),['2-1','1-1'],'exact scores come from what people picked, most popular first');
 assert.equal(label('2-1',score),'2–1');
 const groups=reveal(score,[{question_id:'s',name:'Ege',answer:'2-1',stake:10,total:2},{question_id:'s',name:'Arda',answer:'0-0',stake:10,total:2}]);
 assert.deepEqual(groups.map(g=>g.answer),['2-1','0-0']);
 assert.equal(outcome(c({...result,state:'settled',answer:'away',result_answer:'home'})).text,'You said Liverpool');
 assert.equal(label('yes'),'Yes','custom calls keep Yes / No');
});


test('points are set at the lock from how the group split: rarer right answers score more',async()=>{
 const {callPoints}=await import('../lib/rules');
 assert.equal(callPoints({same:6,total:6}),10,'everyone agreed');
 assert.equal(callPoints({same:3,total:6}),25,'half the group');
 assert.equal(callPoints({same:1,total:6}),35,'the only one: 10 + 25');
 assert.equal(callPoints({same:1,total:4,slot:'motw'}),50,'lone on the match of the week: 33 × 1.5');
 for(const n of [3,6,30])assert.ok(callPoints({same:1,total:n})<=40&&callPoints({same:1,total:n,slot:'motw'})<=60,'capped at 40 / 60');
 assert.equal(callPoints({same:1,total:4,market:'exact_score',exact:'exact'}),30);
 assert.equal(callPoints({same:1,total:4,market:'exact_score',exact:'partial'}),5);
});
