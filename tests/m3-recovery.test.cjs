const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../app/src/main/assets/features');
const {scenario}=require('./fixtures.cjs');
function input(tail){const s=scenario(),sec=180,end=Math.floor(s.now/1000/sec)*sec-sec;const rows=Array.from({length:100},(_,i)=>{const time=end-(99-i)*sec,p=100+i*.01;return[time,p,p+2,p-1,p+1,false];});
 // A provider's missing M1 candle prevents the M3 bucket at index 100-tail-1
 // from being reconstructed. The following M3 candles are fully observed.
 const missingIndex=100-tail-1,missing=rows[missingIndex][0];s.bars.M3=rows.filter((_,i)=>i!==missingIndex);return{s,expectedStart:missing+sec,missing};}
test('XAUUSD resumes closed M3 features from 60 consecutive post-gap candles',()=>{const {s,expectedStart}=input(60),r=F.snapshot(s);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.frames.M3.start,expectedStart*1000);assert.equal(r.frames.M3.sessionGaps,0);});
test('a recent M3 hole stays WAIT until at least 55 consecutive complete bars exist',()=>{const {s}=input(20),r=F.snapshot(s);assert.equal(r.ok,false);assert.equal(r.reason,'GAP_M3');assert.equal(r.gap.contiguousBars,20);});
test('BTC M3 can recover after a proven continuous run without accepting intraday gaps',()=>{const {s,expectedStart}=input(60);s.symbol='BTCUSD';const r=F.snapshot(s);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.frames.M3.start,expectedStart*1000);});
test('a real H1 feed hole remains blocked after M3 recovers',()=>{const {s}=input(60);s.bars.H1.splice(65,1);const r=F.snapshot(s);assert.equal(r.ok,false);assert.equal(r.reason,'GAP_H1');assert.equal(r.gap.contiguousBars,24);});
test('M3 boundary is exactly 55 complete post-gap bars',()=>{const insufficient=F.snapshot(input(54).s),ready=F.snapshot(input(55).s);assert.equal(insufficient.reason,'GAP_M3');assert.equal(insufficient.gap.contiguousBars,54);assert.equal(ready.ok,true,JSON.stringify(ready));});
test('multiple M3 gaps count recovery from the latest missing bucket',()=>{const {s}=input(60);s.bars.M3.splice(s.bars.M3.length-32,1);const r=F.snapshot(s);assert.equal(r.reason,'GAP_M3');assert.equal(r.gap.contiguousBars,31);});
