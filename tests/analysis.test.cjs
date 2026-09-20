const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis.js');
const {scenario,bars}=require('./fixtures.cjs');
function wait(r){assert.equal(r.decision,'WAIT');for(const x of Object.values(r.trade))assert.equal(x,null);}
test('scalp AI V1.4 uses M15 M5 M1 only',()=>{assert.deepEqual(A.FRAMES,['M15','M5','M1']);});
test('formatting rejects invalid prices',()=>{for(const x of [null,undefined,'',0,-1,NaN])assert.equal(A.formatPrice(x),'—');});
for(const symbol of ['XAUUSD','BTCUSD'])for(const sell of [false,true])test(symbol+' '+(sell?'SELL':'BUY')+' scalp signal',()=>{const s=scenario(symbol,sell);delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);assert.equal(r.decision,sell?'SELL':'BUY',JSON.stringify(r));assert.ok(r.score>=70);assert.equal(r.stages.length,3);assert.ok(r.stages[1].ok&&r.stages[2].ok);for(const x of Object.values(r.trade))assert.ok(Number.isFinite(x)&&x>0);});
test('H1 and H4 are ignored entirely',()=>{const s=scenario();s.bars.H4=[];s.bars.H1=[];assert.equal(A.analyze(s).decision,'BUY');});
test('neutral M15 can still allow strong M5 scalp',()=>{const s=scenario();delete s.bars.H4;delete s.bars.H1;s.bars.M15=bars('M15',Array.from({length:90},()=>[100,101,99,100]));const r=A.analyze(s);assert.equal(r.decision,'BUY',JSON.stringify(r));assert.equal(r.bias,'MIXED');assert.ok(r.score>=70);});
test('strong opposite M15 blocks M5 scalp',()=>{const s=scenario();delete s.bars.H4;delete s.bars.H1;s.bars.M15=bars('M15',Array.from({length:90},(_,i)=>{const c=150-i*1.2;return [c+.2,c+.5,c-.5,c];}));const r=A.analyze(s);assert.equal(r.decision,'WAIT');assert.match(r.why,/M15/);});
test('missing M15 M5 or M1 fails closed',()=>{for(const tf of ['M15','M5','M1']){const s=scenario();delete s.bars.H4;delete s.bars.H1;s.bars[tf]=[];wait(A.analyze(s));}});
test('stale, closed and chased entries stay WAIT',()=>{for(const fn of [s=>s.tick.receivedAt-=20000,s=>s.tick.sourceAt-=20000,s=>s.tick.marketState='CLOSED',s=>s.tick.price+=600]){const s=scenario();delete s.bars.H4;delete s.bars.H1;fn(s);wait(A.analyze(s));}});

test('missed first M1 entry becomes controlled REENTRY wait instead of generic failure',()=>{
 const s=scenario();delete s.bars.H4;delete s.bars.H1;s.tick.price+=0.8*30;
 const r=A.analyze(s);
 assert.equal(r.decision,'WAIT');
 assert.equal(r.waitCode,'REENTRY',JSON.stringify(r));
 assert.match(r.why,/تصحيح|الدخول الأول|Re-entry/i);
});
test('valid candidate exposes broad market-state AI features',()=>{
 const s=scenario();delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);
 assert.equal(r.decision,'BUY',JSON.stringify(r));
 const f=r.meta.aiFeatures;
 for(const k of ['vol1','vol5','body1','body5','compression5','distanceEma','trendAge5','entryDistance']) assert.ok(Number.isFinite(f[k]),k);
});
test('multi-strategy detector exports broad opportunity families',()=>{
 for(const fn of ['breakout','breakoutRetest','fakeBreak','liquiditySweep','rangeRejection','detectStrategies']) assert.equal(typeof A[fn],'function',fn);
});
test('valid signal includes human-readable entry basis',()=>{
 const s=scenario();delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);
 assert.equal(r.decision,'BUY',JSON.stringify(r));
 assert.ok(Array.isArray(r.meta.entryBasis));
 assert.ok(r.meta.entryBasis.length>=2);
});
test('AI features include expanded strategy flags',()=>{
 const s=scenario();delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s),f=r.meta.aiFeatures;
 for(const k of ['isBreakout','isBreakoutRetest','isFakeBreak','isLiquiditySweep','isRangeRejection']) assert.ok(k in f,k);
});