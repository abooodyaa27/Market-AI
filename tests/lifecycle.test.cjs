const test=require('node:test'),assert=require('node:assert/strict');const {IDBFactory}=require('fake-indexeddb');
const J=require('../app/src/main/assets/decision-journal'),C=require('../app/src/main/assets/coordinator'),T=require('../app/src/main/assets/trainer'),F=require('../app/src/main/assets/features');
const {input,row,dataset,start}=require('./pipeline-fixtures.cjs');
test('import -> train -> promotion -> BUY -> outcome -> restored training sample; safety overrides model',async()=>{
 const factory=new IDBFactory(),j=new J.Journal(await J.openDB(factory));assert.equal((await j.importDecisions(dataset())).imported,100);
 const result=T.train(await j.all(),null,{symbol:'XAUUSD',now:start+100*180000});assert.equal(result.promoted,true);await j.commitTraining('XAUUSD',result);
 const c=new C.Coordinator(j);await c.init();const i=input(),r=await c.process(i);assert.equal(r.finalDecision,'BUY');
 const price=r.trade.tp+.01;await c.observe('XAUUSD',{bid:price,ask:price+.1,sourceAt:i.now+1000},i.now+1000);
 assert.equal((await j.all()).find(x=>x.id===r.id).positions.BUY.status,'TP1');assert.ok(T.samples(await j.all(),'XAUUSD').some(s=>s.sourceId===r.id));
 const unsafe={...input(i.now+60000),tick:{...i.tick,receivedAt:i.now+60000,sourceAt:i.now-20000}};assert.equal((await c.process(unsafe)).finalDecision,'WAIT');
 j.db.close();const restored=new J.Journal(await J.openDB(factory)),cc=new C.Coordinator(restored);await cc.init();assert.equal(cc.models.XAUUSD.id,result.model.id);assert.equal(await restored.meta('evaluatedUntil:XAUUSD'),result.evaluatedUntil);restored.db.close();
});
test('learnable SELL dataset promotes SELL, missing M15 and stale quotes remain WAIT',async()=>{const rs=dataset();for(const r of rs){r.positions.BUY.r=-1.02;r.positions.SELL.r=.73;}const result=T.train(rs,null,{symbol:'XAUUSD',now:start+100*180000});assert.equal(result.promoted,true);const j=new J.Journal(await J.openDB(new IDBFactory()));await j.commitTraining('XAUUSD',result);const c=new C.Coordinator(j);await c.init();assert.equal((await c.process(input())).finalDecision,'SELL');const bad=input(start+102*180000);delete bad.bars.M15;const r=await c.process(bad);assert.equal(r.finalDecision,'WAIT');assert.ok(r.safety.reasons.includes('MISSING_M15'));j.db.close();});
