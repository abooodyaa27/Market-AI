const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../app/src/main/assets/market-data'),R=require('../app/src/main/assets/risk-engine');
test('a fresh streamed tick with no marketState proves an active quote; stale and explicitly closed ticks do not',()=>{
 const now=1790200000000,raw={symbol:'XAUUSD',bid:100,ask:100.1,mid:100.05,timestamp:now};
 assert.equal(R.preflight({tick:D.normalizeTick(raw,now,true),now}).ok,true);
 assert.equal(R.preflight({tick:D.normalizeTick({...raw,timestamp:now-20000},now,true),now}).ok,false);
 assert.equal(R.preflight({tick:D.normalizeTick({...raw,marketState:'CLOSED'},now,true),now}).ok,false);
 assert.equal(R.preflight({tick:D.normalizeTick(raw,now),now}).ok,false,'REST never infers market status');
});
