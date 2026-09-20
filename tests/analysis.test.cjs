const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis.js');
const {scenario}=require('./fixtures.cjs');
function wait(r){assert.equal(r.decision,'WAIT');for(const x of Object.values(r.trade))assert.equal(x,null);}
test('scalp engine uses M15 M5 M1 only',()=>{assert.deepEqual(A.FRAMES,['M15','M5','M1']);});
test('formatting rejects invalid prices',()=>{for(const x of [null,undefined,'',0,-1,NaN])assert.equal(A.formatPrice(x),'—');});
for(const symbol of ['XAUUSD','BTCUSD'])for(const sell of [false,true])test(symbol+' '+(sell?'SELL':'BUY')+' scalp signal',()=>{const s=scenario(symbol,sell);delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);assert.equal(r.decision,sell?'SELL':'BUY',JSON.stringify(r));assert.equal(r.score,100);assert.equal(r.stages.length,3);assert.ok(r.stages.every(x=>x.ok));for(const x of Object.values(r.trade))assert.ok(Number.isFinite(x)&&x>0);});
test('missing M15 M5 or M1 fails closed',()=>{for(const tf of ['M15','M5','M1']){const s=scenario();delete s.bars.H4;delete s.bars.H1;s.bars[tf]=[];wait(A.analyze(s));}});
test('H1 and H4 are ignored entirely',()=>{const s=scenario();s.bars.H4=[];s.bars.H1=[];assert.equal(A.analyze(s).decision,'BUY');});
test('stale, closed and chased entries stay WAIT',()=>{for(const fn of [s=>s.tick.receivedAt-=20000,s=>s.tick.sourceAt-=20000,s=>s.tick.marketState='CLOSED',s=>s.tick.price+=600]){const s=scenario();delete s.bars.H4;delete s.bars.H1;fn(s);wait(A.analyze(s));}});
