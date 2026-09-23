const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../app/src/main/assets/market-data');
const bar=(t,p=100,open=false)=>[t,p,p+1,p-1,p+.2,open,null];
test('a previously observed complete H1 survives a later provider response that omits it',()=>{
 const before=[bar(360000),bar(363600,101),bar(367200,102)],response=[bar(360000),bar(367200,102)];
 assert.deepEqual(D.mergeHistory(before,response,'H1').map(b=>b[0]),[360000,363600,367200]);
});
test('source corrections win and synthetic live candles never enter the historical cache',()=>{
 const cached=[bar(360000,100),bar(363600,101,true)],response=[bar(360000,110),bar(363600,111,true)];
 assert.deepEqual(D.mergeHistory(cached,response,'H1'),[bar(360000,110),bar(363600,111,true)]);
});
