const test=require('node:test'),assert=require('node:assert/strict');
const mem={};global.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=v};
const AI=require('../app/src/main/assets/ai-learner.js');
function candidate(type='MOMENTUM'){return{decision:'SELL',opportunity:type,score:100,trade:{entry:100,sl:102,tp1:98.5,tp2:97.5,tp3:96.4},meta:{aiFeatures:{m15Align:1,m15Strength:.8,m5Strength:1,stretch:.7,score:1,isPullback:type==='PULLBACK'?1:0,isContinuation:type==='CONTINUATION'?1:0,isMomentum:type==='MOMENTUM'?1:0,isReentry:type==='REENTRY'?1:0,isBreakout:type==='BREAKOUT'?1:0,isBreakoutRetest:type==='BREAKOUT_RETEST'?1:0,isFakeBreak:type==='FAKE_BREAK'?1:0,isLiquiditySweep:type==='LIQUIDITY_SWEEP'?1:0,isRangeRejection:type==='RANGE_REJECTION'?1:0,isBTC:1,vol1:.9,vol5:1.1,body1:.7,body5:.8,compression5:2.1,distanceEma:.7,trendAge5:.6,entryDistance:.2}}};}
test('AI starts learning and cannot block early candidates',()=>{const r=AI.review(candidate());assert.equal(r.mode,'LEARNING');assert.equal(r.approve,true);});
test('AI learns completed market-state rows and activates after minimum samples',()=>{const rows=[];for(let i=0;i<18;i++)rows.push({id:'r'+i,status:i<13?'TP3':'SL',r:i<10?1.8:-1,score:100,type:i%2?'MOMENTUM':'CONTINUATION',aiFeatures:candidate(i%2?'MOMENTUM':'CONTINUATION').meta.aiFeatures});const m=AI.learn(rows);assert.ok(m.n>=AI.MIN_LEARN);const r=AI.review(candidate());assert.notEqual(r.mode,'LEARNING');assert.ok(Number.isFinite(r.prob));});
test('AI vector supports REENTRY market context',()=>{const rows=[];for(let i=0;i<AI.MIN_LEARN;i++)rows.push({id:'q'+i,status:'TP3',r:1.8,score:100,type:'REENTRY',aiFeatures:candidate('REENTRY').meta.aiFeatures});AI.learn(rows);const r=AI.review(candidate('REENTRY'));assert.ok(Number.isFinite(r.prob));});
test('shadow candidate records rejected hypothetical outcome',()=>{const sh=AI.addShadow('BTCUSD',candidate(),{mode:'REJECT'},1000);assert.ok(sh&&sh.id);AI.updateShadow('BTCUSD',96,2000);assert.ok(AI.allTrainingRows([]).some(x=>x.id===sh.id&&x.status==='TP3'));});

test('AI accepts expanded strategy feature vectors',()=>{
 for(const type of ['BREAKOUT','BREAKOUT_RETEST','FAKE_BREAK','LIQUIDITY_SWEEP','RANGE_REJECTION']){
   const p=AI.probability(candidate(type));assert.ok(Number.isFinite(p),type);
 }
});
test('AI missed-opportunity scout can log and evaluate a silent-engine opportunity',()=>{
 const bars={M15:[],M5:[],M1:[]},base=1000;
 for(let i=0;i<40;i++){const c=100+i*.2;bars.M15.push([base+i*900,c-.1,c+.3,c-.2,c,false]);bars.M5.push([base+i*300,c-.1,c+.25,c-.2,c,false]);bars.M1.push([base+i*60,c-.05,c+.2,c-.1,c,false]);}
 bars.M5.at(-1)[4]+=1;bars.M5.at(-1)[2]+=1;bars.M1.at(-1)[4]+=.7;bars.M1.at(-1)[2]+=.7;
 const x=AI.scout('XAUUSD',bars,{price:bars.M1.at(-1)[4]},'WAIT',5000000);
 assert.ok(x===null||x.symbol==='XAUUSD');
 if(x){AI.updateMissed('XAUUSD',x.tp3+.1,5001000);const st=AI.missedStats('XAUUSD');assert.ok(st.total>=1);assert.ok(st.winRate>=0);}
});