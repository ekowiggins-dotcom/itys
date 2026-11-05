import {test} from 'node:test';import assert from 'node:assert/strict';import {betCard,winnerCard,shareLink,shareText,whatsappLink} from '../lib/sharing';
test('WhatsApp messages preserve punctuation and link to the specific bet without other state',()=>{
 const url=shareLink('https://sidebet.example/?old=1','secret invite',{questionId:'q&1',roundId:'r1'});const u=new URL(url);assert.equal(u.pathname,'/share/call');assert.equal(u.searchParams.get('question'),'q&1');assert.equal(u.searchParams.get('invite'),'secret invite');assert.equal(u.searchParams.has('old'),false);
 const card=betCard('Friends & family','Will “Mert & Alex” make it? ✅',3);const text=shareText(card,url);assert.equal(new URL(whatsappLink(text)).searchParams.get('text'),text);assert.ok(text.includes(card.title));assert.ok(!text.includes('stake'));assert.equal(shareLink('https://sidebet.example/?round=old','i'),'https://sidebet.example/?invite=i');
});
test('only final winners receive a card; shared winners retain one-decimal scores',()=>{
 for(const state of ['live','planned','provisional','skipped'])assert.throws(()=>winnerCard('Crew',{state,opens_at:'2030-04-08T00:00:00Z',winners:[{name:'Alex',points_tenths:125}]}),/only after/);
 const card=winnerCard('Crew',{state:'final',opens_at:'2030-04-08T00:00:00Z',winners:[{name:'Alex',points_tenths:125},{name:'Maya',points_tenths:125}]});assert.equal(card.title,'Alex & Maya');assert.equal(card.detail,'12.5 points · Final');assert.equal(card.subtitle,'SHARED WEEKLY WIN');assert.ok(shareText(card,'https://example.com').includes('are this week’s oracles'));
});
test('preview links keep question/round targeting and winner cards never claim an empty winner',()=>{
 const url=new URL(shareLink('https://preview.example','demo',{roundId:'r',winner:true},true));assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('view'),'winner');assert.equal(url.searchParams.get('round'),'r');assert.throws(()=>winnerCard('Crew',{state:'final',opens_at:new Date(),winners:[]}));
 const card=winnerCard('Crew',{state:'final',opens_at:new Date(),winners:Array.from({length:30},(_,i)=>({name:'Friend '+i,points_tenths:10}))});assert.ok(card.title.endsWith('& 28 others'));assert.throws(()=>shareLink('javascript:alert(1)','i'));
});
