(function(root,f){const api=f(typeof module==='object'?require('./decision-engine'):root.AIDecision);if(typeof module==='object')module.exports=api;else root.ModelTrainer=api;})(globalThis,function(E){
'use strict';
const EMBARGO=60000,MIN_ROWS=40,MIN_TRADES=2,MIN_TRAIN=20,MIN_VALIDATION=6,MIN_TEST=6;
// Fixed for all training runs; validation/test outcomes never choose the feature set.
const CORE_FEATURES=['M1.trend','M1.rsi','M3.trend','M5.trend','M15.trend','H1.trend'];
const terminal=new Set(['TP1','SL','EXPIRED']);
function collect(rows,symbol,now=Infinity){
 const out=[],excluded={},seen=new Set();let decisions=0;
 const skip=k=>excluded[k]=(excluded[k]||0)+1;
 for(const r of [...rows].filter(r=>r&&r.symbol===symbol).sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id)))){
  decisions++;const s=r.snapshot;
  if(typeof r.id!=='string'||!Number.isFinite(r.at)||!s?.ok||typeof s.schema!=='string'||!Array.isArray(s.x)||!s.x.length||!s.x.every(Number.isFinite)||!Array.isArray(s.names)||s.names.length!==s.x.length||!s.names.every(n=>typeof n==='string')){skip('INVALID_SNAPSHOT');continue;}
  const parentId=symbol+'|'+(s.bar??r.at);
  for(const side of ['BUY','SELL']){
   const p=r.positions?.[side];if(!p){skip('NO_POSITION');continue;}
   if(p.observationGaps>0||p.status==='CENSORED'){skip('OBSERVATION_GAP');continue;}
   if(p.status==='OPEN'){skip('OPEN');continue;}
   if(!terminal.has(p.status)||!Number.isFinite(p.r)||!Number.isFinite(p.closedAt)||p.closedAt<r.at||p.closedAt<(p.openedAt??r.at)){skip('INVALID_OUTCOME');continue;}
   if(p.closedAt>=now){skip('FUTURE_OUTCOME');continue;}
   const id=parentId+'|'+side;if(seen.has(id)){skip('DUPLICATE_SNAPSHOT');continue;}seen.add(id);
   out.push({id,parentId,sourceId:r.id,side,at:r.at,closedAt:p.closedAt,closedAtBySide:{[side]:p.closedAt},schema:s.schema,x:s.x,names:s.names,legacySide:r.legacySide===side?side:'WAIT',outcomes:{[side]:p.r}});
  }
 }
 return{rows:out.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)),decisions,excluded};
}
function samples(rows,symbol){return collect(rows,symbol).rows;}
function groups(rows){const map=new Map();for(const r of rows){const key=r.parentId??r.id;let g=map.get(key);if(!g){g={parentId:key,at:r.at,closedAt:r.closedAt,rows:[]};map.set(key,g);}g.rows.push(r);g.at=Math.min(g.at,r.at);g.closedAt=Math.max(g.closedAt,r.closedAt);}return [...map.values()].sort((a,b)=>a.at-b.at||a.parentId.localeCompare(b.parentId));}
function partition(rows,evaluatedUntil=0){
 // Choose temporal boundaries after applying embargo so a valid dataset is not rejected
 // merely because the nominal 50/25/25 cut purges one validation sample.
 const gs=groups(rows),times=[...new Set(gs.map(g=>g.at))],fresh=times.filter(t=>t>evaluatedUntil);
 const make=(v,t)=>{const p={train:[],validation:[],test:[],purged:0};if(v===undefined||t===undefined||t<=v)return p;
  for(const g of gs){const bucket=g.at<v?'train':g.at<t?'validation':'test',end=bucket==='train'?v:bucket==='validation'?t:Infinity;
   for(const r of g.rows){if(r.closedAt>=end-EMBARGO)p.purged++;else p[bucket].push(r);}
  }return p;};
 if(evaluatedUntil>0){const v=fresh[0],t=fresh[Math.floor(fresh.length*.5)];return make(v,t);}
 let best=make(times[Math.floor(times.length*.5)],times[Math.floor(times.length*.75)]);
 if(best.train.length>=MIN_TRAIN&&best.validation.length>=MIN_VALIDATION&&best.test.length>=MIN_TEST)return best;
 for(let vi=MIN_TRAIN;vi<times.length;vi++)for(let ti=vi+MIN_VALIDATION;ti<times.length;ti++){
  const p=make(times[vi],times[ti]);
  if(p.train.length<MIN_TRAIN||p.validation.length<MIN_VALIDATION||p.test.length<MIN_TEST)continue;
  if(!best||p.purged<best.purged)best=p;
 }
 return best;
}
function featureIndices(rows){const names=rows[0].names,indices=CORE_FEATURES.map(n=>names.indexOf(n)).filter(i=>i>=0);return indices.length===CORE_FEATURES.length?indices:names.length<=6?names.map((_,i)=>i):[];}
function fit(rows){const size=rows[0].x.length+1,indices=featureIndices(rows),w={BUY:Array(size).fill(0),SELL:Array(size).fill(0)};for(let epoch=0;epoch<100;epoch++)for(const side of ['BUY','SELL']){const sr=rows.filter(r=>Number.isFinite(r.outcomes?.[side]));if(!sr.length)continue;const g=Array(size).fill(0);for(const r of sr){const err=E.predict(r.x,w[side])-Math.max(-3,Math.min(1,r.outcomes[side]));g[0]+=err/sr.length;for(const i of indices)g[i+1]+=err*r.x[i]/sr.length;}w[side][0]-=.015*g[0];for(const i of indices)w[side][i+1]-=.015*(g[i+1]+.25*w[side][i+1]);}return w;}
function metrics(rows,model,legacy=false){
 let balance=0,peak=0,dd=0,busyUntil=-Infinity,wait=0,overlap=0,missingOutcome=0,negativeEdge=0,belowThreshold=0,ambiguous=0,invalidScore=0;const values=[],gs=groups(rows);
 for(const g of gs){if(g.at<=busyUntil){overlap++;continue;}const r=g.rows[0];let side='WAIT';
  if(legacy)side=g.rows.find(r=>r.legacySide!=='WAIT')?.legacySide||'WAIT';
  else if(model){const u={BUY:E.predict(r.x,model.weights.BUY),SELL:E.predict(r.x,model.weights.SELL)};side=u.BUY>=u.SELL?'BUY':'SELL';if(!Number.isFinite(u[side])){invalidScore++;side='WAIT';}else if(u[side]<=0){negativeEdge++;side='WAIT';}else if(u[side]<model.threshold){belowThreshold++;side='WAIT';}else if(Math.abs(u.BUY-u.SELL)<.05){ambiguous++;side='WAIT';}}
  if(!['BUY','SELL'].includes(side)){wait++;continue;}
  const outcome=g.rows.find(r=>Number.isFinite(r.outcomes?.[side]));if(!outcome){missingOutcome++;continue;}
  const value=outcome.outcomes[side];values.push(value);balance+=value;peak=Math.max(peak,balance);dd=Math.max(dd,peak-balance);busyUntil=outcome.closedAtBySide?.[side]??outcome.closedAt;
 }
 const n=values.length,mean=n?balance/n:0,variance=n>1?values.reduce((s,x)=>s+(x-mean)**2,0)/(n-1):0;
 return{groups:gs.length,trades:n,wait,negativeEdge,belowThreshold,ambiguous,invalidScore,overlap,missingOutcome,meanR:mean,totalR:balance,maxDrawdownR:dd,winRate:n?values.filter(v=>v>0).length/n:0,lowerMean95:n?mean-1.96*Math.sqrt(variance/n):0,profitFactor:values.some(x=>x<0)?values.filter(x=>x>0).reduce((a,b)=>a+b,0)/-values.filter(x=>x<0).reduce((a,b)=>a+b,0):null};
}
function better(a,b,legacy){return a.trades>=MIN_TRADES&&a.missingOutcome===0&&b.missingOutcome===0&&legacy.missingOutcome===0&&a.lowerMean95>0&&a.meanR>b.meanR+.02&&a.totalR>b.totalR&&a.maxDrawdownR<=Math.max(8,b.maxDrawdownR+1)&&a.meanR>legacy.meanR&&a.totalR>legacy.totalR;}
function train(raw,incumbent,{symbol,now=Date.now(),evaluatedUntil=0}={}){
 if(incumbent?.dataPolicy!=='observed-contiguous-v1')incumbent=null;
 const c=collect(raw,symbol,now),all=c.rows,p=partition(all,evaluatedUntil),fresh=groups(all).filter(g=>g.at>evaluatedUntil).length;
 const counts={train:p.train.length,validation:p.validation.length,test:p.test.length},diagnostics={decisions:c.decisions,samples:all.length,groups:groups(all).length,trainGroups:groups(p.train).length,validationGroups:groups(p.validation).length,testGroups:groups(p.test).length,modelFeatures:p.train.length?featureIndices(p.train).map(i=>p.train[0].names[i]):[],excluded:c.excluded,purged:p.purged,newHoldoutGroups:fresh,counts,deficits:{samples:Math.max(0,MIN_ROWS-all.length),train:Math.max(0,MIN_TRAIN-counts.train),validation:Math.max(0,MIN_VALIDATION-counts.validation),test:Math.max(0,MIN_TEST-counts.test)}};
 const base={runId:symbol+'-'+now,promoted:false,stage:'SAMPLES',reason:'INSUFFICIENT_DATA',evaluatedUntil,diagnostics};
 if(evaluatedUntil>0&&fresh<10)return{...base,reason:'NEED_NEW_HOLDOUT'};
 if(Object.values(diagnostics.deficits).some(n=>n>0))return base;
 const dim=p.train[0].x.length,schema=p.train[0].schema,names=JSON.stringify(p.train[0].names);
 if(all.some(r=>r.x.length!==dim||r.schema!==schema||JSON.stringify(r.names)!==names))return{...base,reason:'INVALID_DATASET'};
 if(!diagnostics.modelFeatures.length)return{...base,reason:'UNSUPPORTED_FEATURE_SCHEMA'};
 // Each side needs real training labels; never infer an unseen side from zero weights.
 if(['BUY','SELL'].some(side=>!p.train.some(r=>Number.isFinite(r.outcomes[side]))))return{...base,reason:'MISSING_TRAIN_SIDE'};
 if(['BUY','SELL'].some(side=>p.train.filter(r=>Number.isFinite(r.outcomes[side])).length<diagnostics.modelFeatures.length+2))return{...base,reason:'INSUFFICIENT_TRAIN_SIDE'};
 const weights=fit(p.train);
 if(!Object.values(weights).every(w=>w.every(v=>Number.isFinite(v)&&Math.abs(v)<100)))return{...base,stage:'TRAIN',reason:'UNSTABLE_MODEL'};
 const options=[0,.025,.05,.1,.2,.3].map(threshold=>({weights,threshold})),candidates=options.map(model=>({model,metrics:metrics(p.validation,model)}));
 const eligible=candidates.filter(c=>c.metrics.trades>=MIN_TRADES&&c.metrics.missingOutcome===0).sort((a,b)=>b.metrics.lowerMean95-a.metrics.lowerMean95),chosen=eligible[0];
 // Persist the full attempted holdout watermark even after a failed validation/test.
 const until=Math.max(evaluatedUntil,...p.validation.concat(p.test).map(r=>r.closedAt));
 const evidence={counts,embargoMs:EMBARGO,trainEnd:Math.max(...p.train.map(r=>r.closedAt)),validationStart:p.validation[0].at,testStart:p.test[0].at,testEnd:until,validationCandidates:candidates.map(c=>({threshold:c.model.threshold,...c.metrics})),validation:chosen?.metrics||candidates[0].metrics,test:null};
 const trained={...base,stage:'VALIDATION',evaluatedUntil:until,evidence};
 if(!chosen)return{...trained,reason:candidates.some(c=>c.metrics.trades>=MIN_TRADES&&c.metrics.missingOutcome>0)?'MISSING_VALIDATION_OUTCOMES':'INSUFFICIENT_VALIDATION_TRADES'};
 const test=metrics(p.test,chosen.model);evidence.test=test;
 if(test.missingOutcome>0)return{...trained,stage:'TEST',reason:'MISSING_TEST_OUTCOMES'};
 if(test.trades<MIN_TRADES)return{...trained,stage:'TEST',reason:'INSUFFICIENT_TEST_TRADES'};
 if(incumbent&&(incumbent.schema!==schema||incumbent.symbol!==symbol||!['BUY','SELL'].every(s=>Array.isArray(incumbent.weights?.[s])&&incumbent.weights[s].length===dim+1)))return{...trained,reason:'INVALID_INCUMBENT'};
 const oldVal=metrics(p.validation,incumbent),oldTest=metrics(p.test,incumbent),legacyVal=metrics(p.validation,null,true),legacyTest=metrics(p.test,null,true);
 Object.assign(evidence,{incumbentId:incumbent?.id||'WAIT_COLD_START',baseline:'V1.9 rules on identical closed-bar snapshots',incumbent:{validation:oldVal,test:oldTest},legacy:{validation:legacyVal,test:legacyTest}});
 const promoted=better(chosen.metrics,oldVal,legacyVal)&&better(test,oldTest,legacyTest);
 const model=promoted?{...chosen.model,id:symbol+'-'+now,symbol,schema,dataPolicy:'observed-contiguous-v1',validated:true,trainedUntil:evidence.trainEnd,testedUntil:until,confidenceKind:'edge_score_not_probability',evidence}:null;
 return{...trained,stage:'PROMOTION',promoted,reason:promoted?'PROMOTED':'NO_PROVEN_IMPROVEMENT',model};
}
function describe(r){const d=r.diagnostics,c=d?.counts,e=r.evidence,labels={INSUFFICIENT_DATA:'العينات الصالحة بعد الفصل الزمني غير كافية',NEED_NEW_HOLDOUT:'يلزم سجل جديد لم يُستخدم سابقًا في التحقق والاختبار',INSUFFICIENT_VALIDATION_TRADES:'تم التدريب؛ فرص التحقق المقبولة غير كافية',MISSING_VALIDATION_OUTCOMES:'تم التدريب؛ تنقص نتائج الجهة التي اختارها النموذج في التحقق',INSUFFICIENT_TEST_TRADES:'تم التدريب والتحقق؛ صفقات الاختبار غير كافية',MISSING_TEST_OUTCOMES:'تم التحقق؛ تنقص نتائج الجهة التي اختارها النموذج في الاختبار',INSUFFICIENT_TRAIN_SIDE:'عينات التدريب لإحدى جهتي BUY/SELL أقل من اللازم قياسًا بخصائص النموذج',MISSING_TRAIN_SIDE:'نتائج إحدى جهتي BUY/SELL غير موجودة في التدريب',UNSUPPORTED_FEATURE_SCHEMA:'خصائص البيانات لا تطابق نموذج التدريب المدعوم',NO_PROVEN_IMPROVEMENT:'تم التدريب والاختبار؛ لم تثبت أفضلية تسمح بالترقية',PROMOTED:'اجتاز النموذج التحقق والاختبار وتم اعتماده'};const val=e?.validation,test=e?.test;return[labels[r.reason]||r.reason,r.reason,c?'Train '+c.train+' / Validation '+c.validation+' / Test '+c.test:'',d?.modelFeatures?'فرص مستقلة '+d.trainGroups+' / '+d.validationGroups+' / '+d.testGroups+' • خصائص مستخدمة '+d.modelFeatures.length:'',d?'صالحة '+d.samples+' • مستبعدة لفجوات الرصد '+(d.excluded?.OBSERVATION_GAP||0)+' • فصل زمني '+d.purged:'',val?'Validation: '+val.trades+' صفقات • WAIT '+val.wait+(Number.isFinite(val.negativeEdge)?' (بدون أفضلية موجبة '+val.negativeEdge+' • دون العتبة '+val.belowThreshold+' • اتجاه ملتبس '+val.ambiguous+')':'')+' • تداخل '+val.overlap+' • نتيجة مفقودة '+val.missingOutcome:'',test?'Test: '+test.trades+' صفقات • WAIT '+test.wait+' • تداخل '+test.overlap+' • نتيجة مفقودة '+test.missingOutcome+' • '+test.meanR.toFixed(3)+'R':''].filter(Boolean).join(' • ');}
return{samples,collect,partition,fit,metrics,train,describe,MIN_ROWS,MIN_TRADES,MIN_TRAIN,MIN_VALIDATION,MIN_TEST};
});
