const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis.js');
const F=require('../app/src/main/assets/features.js');
const T=require('../app/src/main/assets/trainer.js');
const {scenario}=require('./fixtures.cjs');
test('scalp targets are shorter than official swing targets',()=>{const s=scenario();delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);assert.equal(r.decision,'BUY');const risk=r.trade.entry-r.trade.sl;assert.ok(Math.abs((r.trade.tp1-r.trade.entry)/risk-.75)<.01);assert.ok(Math.abs((r.trade.tp3-r.trade.entry)/risk-1.8)<.01);});
test('XAUUSD M15 accepts a real session break but rejects missing intraday candles',()=>{assert.equal(F.gapKind('XAUUSD','M15',4500,900,Date.UTC(2026,8,14,20,45)/1000),'SESSION');assert.equal(F.gapKind('XAUUSD','M15',1800,900,Date.UTC(2026,8,14,10)/1000),'BAD');assert.equal(F.gapKind('BTCUSD','M15',8*3600,900),'BAD');});
test('AI cold start is reduced but still requires temporal validation and test',()=>{assert.equal(T.MIN_ROWS,40);assert.ok(T.MIN_TRAIN>=20);assert.ok(T.MIN_VALIDATION>=6);assert.ok(T.MIN_TEST>=6);assert.ok(T.MIN_TRADES>=2);});

test('trainer reserves larger independent validation and test windows',()=>{const rows=[];for(let i=0;i<40;i++)rows.push({id:'r'+i,parentId:'p'+i,at:i*100000,closedAt:i*100000+1000});const p=T.partition(rows);assert.equal(p.test.length,10);assert.ok(p.validation.length>=9);});

test('live XAUUSD M15 tolerates a small provider hole but not stale or large gaps',()=>{const prev=Date.UTC(2026,8,22,9)/1000,last=prev+1800,now=(last+600)*1000;assert.equal(F.usableGap('XAUUSD','M15',1800,900,prev,now,last),'FEED');assert.equal(F.usableGap('XAUUSD','M15',5400,900,prev,now,last),'BAD');});
test('trainer searches temporal boundaries after embargo',()=>{const rows=[];for(let i=0;i<48;i++)rows.push({id:'e'+i,parentId:'e'+i,at:i*120000,closedAt:i*120000+70000});const p=T.partition(rows);assert.ok(p.train.length>=20);assert.ok(p.validation.length>=6);assert.ok(p.test.length>=6);});
