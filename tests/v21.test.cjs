const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis.js');
const {scenario,bars}=require('./fixtures.cjs');

test('H4 neutral does not veto a confirmed H1 setup',()=>{
 const s=scenario();
 s.bars.H4=bars('H4',Array.from({length:90},()=>[100,101,99,100]));
 const r=A.analyze(s);
 assert.equal(r.decision,'BUY',JSON.stringify(r));
 assert.equal(r.bias,'MIXED');
 assert.ok(r.score>=70);
});

test('strong opposite H4 vetoes H1 direction',()=>{
 const s=scenario();
 const opp=scenario('XAUUSD',true);
 s.bars.H4=opp.bars.H4;
 const r=A.analyze(s);
 assert.equal(r.decision,'WAIT');
 assert.match(r.why,/H4/);
});

test('signal result exposes score and opportunity type',()=>{
 const r=A.analyze(scenario());
 assert.equal(r.decision,'BUY');
 assert.ok(r.score>=70);
 assert.ok(['PULLBACK','CONTINUATION'].includes(r.opportunity));
});
