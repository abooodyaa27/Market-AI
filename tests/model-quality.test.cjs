const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../app/src/main/assets/trainer'),F=require('../app/src/main/assets/features');
const start=Date.UTC(2026,8,14,10);
const dataset=(n=100)=>Array.from({length:n},(_,i)=>{const at=start+i*180000;return{id:'d'+i,symbol:'XAUUSD',at,snapshot:{ok:true,schema:F.VERSION,bar:at,x:[0],names:['test']},legacySide:'WAIT',positions:{BUY:{side:'BUY',status:'TP1',r:.73,openedAt:at,closedAt:at+10000},SELL:{side:'SELL',status:'SL',r:-1.02,openedAt:at,closedAt:at+10000}}};});

test('the trained gold model uses a small fixed set of causal indicators',()=>{
 const names=['M1.trend','M1.slope','M1.momentum','M1.body','M1.range','M1.rsi','M1.sessionGaps','M3.trend','M5.trend','M15.trend','H1.trend','H4.trend'];
 const rows=dataset().map((r,i)=>({...r,snapshot:{...r.snapshot,schema:F.VERSION,names,x:names.map((_,k)=>k===0?i/100:0)}}));
 const model=T.train(rows,null,{symbol:'XAUUSD',now:start+100*180000});
 assert.ok(model.evidence,'model must reach validation');
 assert.ok(model.diagnostics.modelFeatures.length>0);
 assert.ok(model.diagnostics.modelFeatures.length<=6);
 assert.equal(model.diagnostics.trainGroups,model.diagnostics.counts.train/2);
 const weights=T.fit(T.partition(T.samples(rows,'XAUUSD')).train);
 assert.equal(weights.BUY.length,names.length+1);
 for(let j=0;j<names.length;j++)if(!model.diagnostics.modelFeatures.includes(names[j]))assert.equal(weights.BUY[j+1],0);
});

test('validation explains negative learned scores as the cause of WAIT',()=>{
 const rows=dataset().map(r=>{r.positions.BUY.r=-1;r.positions.SELL.r=-1;return r;});
 const result=T.train(rows,null,{symbol:'XAUUSD',now:start+100*180000});
 assert.equal(result.reason,'INSUFFICIENT_VALIDATION_TRADES');
 assert.equal(result.evidence.validation.negativeEdge,result.evidence.validation.groups);
 assert.match(T.describe(result),/أفضلية موجبة/);
 assert.ok(result.evaluatedUntil>0,'failed validation still consumes its holdout');
});

test('short side history never fits more learned features than it can support',()=>{
 const rows=dataset(100).map((r,i)=>{if(i<49)delete r.positions.SELL;return r;});
 const result=T.train(rows,null,{symbol:'XAUUSD',now:start+100*180000});
 assert.equal(result.reason,'INSUFFICIENT_TRAIN_SIDE');
 assert.equal(result.promoted,false);
});

test('an unavailable selected-side result cannot invent overlap with later opportunities',()=>{
 const rows=dataset(3);delete rows[0].positions.SELL;rows[0].positions.BUY.closedAt=rows[0].at+10*60000;
 const model={weights:{BUY:[0,0],SELL:[1,0]},threshold:0};
 const result=T.metrics(T.samples(rows,'XAUUSD'),model);
 assert.equal(result.missingOutcome,1);
 assert.equal(result.trades,2);
 assert.equal(result.overlap,0);
});

test('test results missing for a selected trade reject promotion explicitly',()=>{
 const rows=dataset();delete rows[80].positions.BUY;
 const result=T.train(rows,null,{symbol:'XAUUSD',now:start+100*180000});
 assert.equal(result.reason,'MISSING_TEST_OUTCOMES');
 assert.equal(result.promoted,false);
 assert.ok(result.evidence.test.missingOutcome>0);
});

test('stored evaluations from 3.0.2 remain readable after upgrade',()=>{
 const old={reason:'INSUFFICIENT_VALIDATION_TRADES',diagnostics:{samples:48,excluded:{OBSERVATION_GAP:59},purged:4,counts:{train:23,validation:11,test:10}},evidence:{validation:{trades:0,wait:6,overlap:0,missingOutcome:0}}};
 const message=T.describe(old);
 assert.match(message,/Train 23 \/ Validation 11 \/ Test 10/);
 assert.doesNotMatch(message,/undefined|NaN/);
});

test('live decisions require a strictly positive learned edge even with threshold zero',()=>{
 const E=require('../app/src/main/assets/decision-engine');
 const s={ok:true,symbol:'XAUUSD',schema:F.VERSION,at:start+1000,x:[0],names:['test']};
 const model={validated:true,dataPolicy:'observed-contiguous-v1',symbol:'XAUUSD',schema:F.VERSION,trainedUntil:start-1000,testedUntil:start,threshold:0,weights:{BUY:[0,0],SELL:[-1,0]}};
 assert.equal(E.decide(s,model).decision,'WAIT');
});
