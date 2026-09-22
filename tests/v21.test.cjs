const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis.js');
const F=require('../app/src/main/assets/features.js');
const T=require('../app/src/main/assets/trainer.js');
const {scenario}=require('./fixtures.cjs');
test('scalp targets are shorter than official swing targets',()=>{const s=scenario();delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);assert.equal(r.decision,'BUY');const risk=r.trade.entry-r.trade.sl;assert.ok(Math.abs((r.trade.tp1-r.trade.entry)/risk-.75)<.01);assert.ok(Math.abs((r.trade.tp3-r.trade.entry)/risk-1.8)<.01);});
test('XAUUSD M15 accepts a real session break but rejects missing intraday candles',()=>{assert.equal(F.gapKind('XAUUSD','M15',8*3600,900),'SESSION');assert.equal(F.gapKind('XAUUSD','M15',1800,900),'BAD');assert.equal(F.gapKind('BTCUSD','M15',8*3600,900),'BAD');});
test('AI cold start is reduced but still requires temporal validation and test',()=>{assert.equal(T.MIN_ROWS,40);assert.ok(T.MIN_TRAIN>=20);assert.ok(T.MIN_VALIDATION>=6);assert.ok(T.MIN_TEST>=6);assert.ok(T.MIN_TRADES>=3);});
