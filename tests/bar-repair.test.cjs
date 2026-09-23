const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../app/src/main/assets/market-data');
const bar=(t,open=100)=>[t,open,open+2,open-1,open+1,false];
test('a missing H1 candle is restored only from twelve complete source M5 candles',()=>{
 const start=3600*100,source=Array.from({length:36},(_,i)=>bar(start+i*300));
 const native=[bar(start),bar(start+7200)];
 const repaired=D.repair(native,source,3600,300);
 assert.deepEqual(repaired.map(b=>b[0]),[start,start+3600,start+7200]);
 assert.deepEqual(native.map(b=>b[0]),[start,start+7200],'native history is immutable');
 assert.deepEqual(D.repair(native,source.filter(b=>b[0]!==start+3900),3600,300),native,'no OHLC invented across a missing M5');
 assert.deepEqual(D.repair(native,source.map(b=>b[0]===start+3900?[...b.slice(0,5),true]:b),3600,300),native,'live source candles never close history');
});
test('repair preserves native OHLC and cannot introduce duplicate timestamps',()=>{
 const start=3600*200,source=Array.from({length:24},(_,i)=>bar(start+i*300));
 const original=[bar(start,101),bar(start+3600,102)];
 assert.deepEqual(D.repair(original,source,3600,300),original);
});
