const test=require('node:test'),assert=require('node:assert/strict');
const mem={};global.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=v};
const AI=require('../app/src/main/assets/ai-learner.js');
function candidate(type='MOMENTUM'){return{decision:'SELL',opportunity:type,score:100,trade:{entry:100,sl:102,tp1:98.5,tp2:97.5,tp3:96.4},meta:{aiFeatures:{m15Align:1,m15Strength:.8,m5Strength:1,stretch:.7,score:1,isPullback:type==='PULLBACK'?1:0,isContinuation:type==='CONTINUATION'?1:0,isMomentum:type==='MOMENTUM'?1:0,isBTC:1}}};}
test('AI starts in learning mode and does not block early candidates',()=>{const r=AI.review(candidate());assert.equal(r.mode,'LEARNING');assert.equal(r.approve,true);});
test('AI learns completed labeled rows',()=>{const rows=[];for(let i=0;i<12;i++)rows.push({id:'r'+i,status:i<9?'TP3':'SL',r:i<9?1.8:-1,score:100,type:'MOMENTUM',aiFeatures:candidate().meta.aiFeatures});const m=AI.learn(rows);assert.ok(m.n>=12);const r=AI.review(candidate());assert.notEqual(r.mode,'LEARNING');assert.ok(Number.isFinite(r.prob));});
test('shadow candidate records rejected hypothetical outcome store',()=>{const c=candidate();const sh=AI.addShadow('BTCUSD',c,{mode:'REJECT'},1000);assert.ok(sh&&sh.id);AI.updateShadow('BTCUSD',96,2000);const all=AI.allTrainingRows([]);assert.ok(all.some(x=>x.id===sh.id&&x.status==='TP3'));});
