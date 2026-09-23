const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../app/src/main/assets/trainer');
const {dataset,start}=require('./pipeline.test.cjs');

test('holdout progress counts new independent resolved opportunities, never two sides twice',()=>{
 const rows=dataset(20),cutoff=rows[9].at;
 const progress=T.progress(rows,'XAUUSD',cutoff);
 assert.equal(progress.samples,40);
 assert.equal(progress.opportunities,20);
 assert.equal(progress.newHoldout,10);
 assert.equal(progress.requiredNewHoldout,10);
 assert.equal(T.progress(rows,'XAUUSD',rows[19].at).newHoldout,0);
 assert.equal(T.progress(rows,'XAUUSD',0).newHoldout,null);
});

test('a WAIT snapshot without paper positions does not become training progress',()=>{
 const rows=dataset(1);
 rows.push({id:'gap',symbol:'XAUUSD',at:start+180000,snapshot:{ok:false,reason:'GAP_H1'},positions:{}});
 const progress=T.progress(rows,'XAUUSD',0);
 assert.equal(progress.samples,2);
 assert.equal(progress.opportunities,1);
});
