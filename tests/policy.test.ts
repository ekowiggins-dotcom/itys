// Product guardrails. These keep the app a free prediction game, not gambling.
// If one fails, don't loosen it to make a change pass: read AGENTS.md first.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';import ts from 'typescript';import path from 'node:path';

const files=(dir:string,exts:string[]):string[]=>readdirSync(dir).flatMap(n=>{const p=path.join(dir,n);return statSync(p).isDirectory()?files(p,exts):exts.some(e=>p.endsWith(e))?[p]:[]});
const ui=[...files('app',['.ts','.tsx']),...files('lib',['.ts'])];

// Visible text: every string literal, template text and JSX text, read with the TypeScript parser.
// Lowercase strings without punctuation are skipped: those are class names and keys ('bet-meta', 'bet compact'),
// and SQL is skipped (internal column names like `stake` are never shown).
function visibleText(src:string,file:string){
 const out:string[]=[];
 const sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const visit=(n:ts.Node)=>{
  if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))return;
  let t:string|undefined;
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n))t=n.text;
  else if(ts.isJsxText(n))t=n.text;
  if(t){t=t.trim();if(t.includes(' ')&&!/\b(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/.test(t)&&!/^[a-z0-9 _.:-]+$/.test(t))out.push(t);}
  ts.forEachChild(n,visit);
 };
 visit(sf);
 return out;
}

test('players never see betting or gambling vocabulary',()=>{
 const banned=/\b(bets?|betting|bettor|wagers?|wagering|stakes?|staking|gambl\w*|odds|payouts?|jackpot|casino|bookie|bookmaker|punters?)\b/i;
 const hits=ui.flatMap(f=>visibleText(readFileSync(f,'utf8'),f).filter(t=>banned.test(t)).map(t=>f+': '+t.slice(0,90)));
 assert.deepEqual(hits,[],'Use calls, predictions and confidence points instead:\n'+hits.join('\n'));
});

test('no casino or money imagery in the interface',()=>{
 const casino=/[\u{1F4B0}\u{1F4B5}-\u{1F4B8}\u{1F4B2}\u{1F911}\u{1FA99}\u{1F3B0}\u{1F3B2}\u{1F0CF}\u{1F3E6}♠♣♥♦]/u;
 const hits=[...ui,...files('ios/App/SidebetWidget',['.swift'])].filter(f=>casino.test(readFileSync(f,'utf8')));
 assert.deepEqual(hits,[],'Coins, cash, chips, dice, cards, slot machines and banks are not allowed: '+hits.join(', '));
});

test('every server action is reviewed: none can buy, sell, gift, transfer or cash out points',()=>{
 // Adding an action? Confirm it cannot move points between people or exchange them for anything, then list it here.
 const reviewed=['create','join','question','predict','registerDevice','unregisterDevice',
  'report','unblock','subjectRemoval','reviewRemoval','removeBet','appealRemoval','recoverAdmin','respondRecovery','leave','transfer','propose','dispute','judge','block','season','longterm','predictLongterm','judgeSettings','notificationPreferences','notificationRead','seasonNoticeRead','tick',
  'footballSettings','footballExtra','footballSwap','footballMotw','footballSearch'];
 const src=['lib/service.ts','lib/lifecycle.ts','lib/football/actions.ts'].map(f=>readFileSync(f,'utf8')).join('\n');
 const found=new Set<string>();
 for(const m of src.matchAll(/action:z\.(?:enum\(\[([^\]]*)\]\)|literal\('([^']+)'\))/g))for(const a of (m[1]??`'${m[2]}'`).matchAll(/'([^']+)'/g))found.add(a[1]);
 for(const m of src.matchAll(/action===?'([a-zA-Z]+)'/g))found.add(m[1]);
 const unreviewed=[...found].filter(a=>!reviewed.includes(a));
 assert.deepEqual(unreviewed,[],'New server actions need a points-rules review (see AGENTS.md): '+unreviewed.join(', '));
 const money=/^(buy|purchase|sell|gift|tip|send|cash|redeem|withdraw|deposit|topup|top_up|wallet|prize|reward|payout)/i;
 assert.deepEqual([...found].filter(a=>money.test(a)),[]);
 // 'transfer' is the admin-role handover; make sure it never touches points.
 const transfer=readFileSync('lib/lifecycle.ts','utf8').match(/data\.action==='transfer'\)\{([^}]*)\}/)?.[1]||'';
 assert.ok(transfer.includes('UPDATE groups SET admin')&&!/points|stake|score/i.test(transfer),'transfer must only move the admin role');
});

test('no payments, wallets or prizes anywhere in the stack',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 const deps=Object.keys({...pkg.dependencies,...pkg.devDependencies});
 const pay=/stripe|paypal|braintree|adyen|iyzico|revenuecat|purchases|in-app-purchase|iap|billing|crypto-?wallet|web3|ethers|solana/i;
 assert.deepEqual(deps.filter(d=>pay.test(d)),[],'Payment SDKs are not allowed: points can never be bought.');
 const schema=files('migrations',['.sql']).map(f=>readFileSync(f,'utf8')).join('\n')+readFileSync('lib/db.ts','utf8');
 assert.ok(!/\b(balance|wallet|purchases?|payments?|prizes?|payouts?|withdrawals?|deposits?|transactions_ledger)\b/i.test(schema),'No money-like tables or columns.');
 const entitlements=files('ios',['.entitlements','.plist']).map(f=>readFileSync(f,'utf8')).join('\n');
 assert.ok(!/in-app-payments|com\.apple\.developer\.in-app-payments/i.test(entitlements),'No in-app payments capability.');
});

test('confidence points reset every round and cannot exceed 100 per person',()=>{
 const svc=readFileSync('lib/service.ts','utf8');
 assert.match(svc,/used\+stake<=100/);
 assert.match(svc,/q\.round_id=\$1 AND p\.user_id=\$2/,'the 100-point budget is per round and per person');
});

test('the old name never reaches players: the brand comes from lib/brand.ts',()=>{
 const old=/\bsidebet\b/i;
 const hits=[...ui,...files('ios/App/SidebetWidget',['.swift','.plist']),'ios/App/App/Info.plist','capacitor.config.ts']
  .flatMap(f=>{const src=readFileSync(f,'utf8');return (f.endsWith('.ts')||f.endsWith('.tsx')?visibleText(src,f):src.split('\n')).filter(t=>old.test(t)&&!/SidebetAppGroup|SidebetWidget|SIDEBET_|x-sidebet-client/i.test(t)).map(t=>f+': '+t.trim().slice(0,80))});
 assert.deepEqual(hits,[]);
});
