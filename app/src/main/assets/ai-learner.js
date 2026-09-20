/* Market AI on-device adaptive reviewer V1.3.
   Learns market environment, not only setup names. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AILearner=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const KEY='market_ai_scalp_ai_v13_model',SHADOW_KEY='market_ai_scalp_ai_v13_shadow',MIN_LEARN=12,LR=.045,L2=.0025;
const names=['bias','m15Align','m15Strength','m5Strength','stretch','score','isPullback','isContinuation','isMomentum','isReentry','isBTC','vol1','vol5','body1','body5','compression5','distanceEma','trendAge5','entryDistance'];
function sigmoid(z){return 1/(1+Math.exp(-Math.max(-12,Math.min(12,z))));}
function fresh(){return{version:2,n:0,w:[0,.10,.05,.12,-.12,.18,.04,.04,.03,.03,0,-.03,-.02,.03,.03,-.04,-.06,.04,-.06],lastLearned:null};}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&Array.isArray(x.w)&&x.w.length===names.length?x:fresh();}catch{return fresh();}}
function save(m){try{localStorage.setItem(KEY,JSON.stringify(m));}catch{}}
const num=(v,max=3)=>Math.max(-max,Math.min(max,Number(v)||0));
function vec(candidate){
 const f=candidate?.meta?.aiFeatures||{};
 return[1,num(f.m15Align,1),num(f.m15Strength,1.5),num(f.m5Strength,1.5),num(f.stretch,2.5),num(f.score,1),f.isPullback?1:0,f.isContinuation?1:0,f.isMomentum?1:0,f.isReentry?1:0,f.isBTC?1:0,num(f.vol1,3),num(f.vol5,3),num(f.body1,3),num(f.body5,3),num(f.compression5,4),num(f.distanceEma,3),num(f.trendAge5,1),num(f.entryDistance,2)];
}
function probability(candidate,m=load()){const x=vec(candidate);let z=0;for(let i=0;i<x.length;i++)z+=m.w[i]*x[i];return sigmoid(z);}
function labelFromRow(r){if(!r||r.status==='OPEN')return null;if(/^TP/.test(r.status))return 1;if(r.status==='SL')return 0;if(r.status==='EXPIRED')return Number(r.r)>0?1:Number(r.r)<0?0:null;if(r.status==='INVALIDATED')return null;return null;}
function trainOne(m,candidate,y){const x=vec(candidate),p=probability(candidate,m),err=y-p;for(let i=0;i<m.w.length;i++)m.w[i]+=LR*(err*x[i]-L2*m.w[i]);m.n++;m.lastLearned=Date.now();return p;}
function hydrateCandidate(row){return{meta:{aiFeatures:row.aiFeatures||{}},score:row.score||0,opportunity:row.type||null};}
function learn(rows=[]){const m=load(),learned=new Set(m.learnedIds||[]);for(const r of rows){const y=labelFromRow(r);if(y===null||learned.has(r.id)||!r.aiFeatures)continue;trainOne(m,hydrateCandidate(r),y);learned.add(r.id);}m.learnedIds=[...learned].slice(-1500);save(m);return m;}
function review(candidate){
 const m=load(),p=probability(candidate,m),enough=m.n>=MIN_LEARN;
 if(!enough)return{mode:'LEARNING',approve:true,prob:p,confidence:Math.min(1,m.n/MIN_LEARN),samples:m.n,reason:'AI يتعلم بيئة السوق الآن ولا يمنع الإشارة قبل اكتمال عينات كافية.'};
 if(p>=.58)return{mode:'APPROVE',approve:true,prob:p,confidence:Math.min(1,(m.n-MIN_LEARN+1)/30),samples:m.n,reason:'AI وافق: بيئة السوق الحالية تشبه حالات ناجحة سابقة.'};
 if(p<.42)return{mode:'REJECT',approve:false,prob:p,confidence:Math.min(1,(m.n-MIN_LEARN+1)/30),samples:m.n,reason:'AI رفض: بيئة السوق الحالية تشبه حالات ضعيفة سابقة.'};
 return{mode:'CAUTION',approve:true,prob:p,confidence:Math.min(1,(m.n-MIN_LEARN+1)/30),samples:m.n,reason:'AI محايد: يسمح بإشارة القواعد مع حذر.'};
}
function shadowLoad(){try{const x=JSON.parse(localStorage.getItem(SHADOW_KEY)||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
function shadowSave(x){try{localStorage.setItem(SHADOW_KEY,JSON.stringify(x.slice(-500)));}catch{}}
function addShadow(symbol,candidate,review,now=Date.now()){
 if(!candidate||!['BUY','SELL'].includes(candidate.decision))return null;const rows=shadowLoad(),dup=rows.find(x=>x.status==='OPEN'&&x.symbol===symbol&&x.side===candidate.decision&&Math.abs(x.entry-candidate.trade.entry)<=Math.max(.00001,Math.abs(candidate.trade.entry)*.00005));if(dup)return dup;
 const r={id:'shadow-'+symbol+'-'+now,symbol,openedAt:now,closedAt:null,status:'OPEN',side:candidate.decision,type:candidate.opportunity,score:candidate.score,entry:candidate.trade.entry,sl:candidate.trade.sl,tp1:candidate.trade.tp1,tp2:candidate.trade.tp2,tp3:candidate.trade.tp3,r:0,aiReview:review?.mode||'REJECT',aiFeatures:candidate.meta?.aiFeatures||null};rows.push(r);shadowSave(rows);return r;
}
function updateShadow(symbol,price,now=Date.now()){
 if(!(Number.isFinite(price)&&price>0))return;const rows=shadowLoad();let changed=false;
 for(const x of rows){if(x.symbol!==symbol||x.status!=='OPEN')continue;const d=x.side==='BUY'?1:-1,risk=Math.abs(x.entry-x.sl),move=(price-x.entry)*d;
 if((price-x.tp3)*d>=0){x.status='TP3';x.r=1.8;x.closedAt=now;}
 else if((price-x.sl)*d<=0){x.status='SL';x.r=-1;x.closedAt=now;}
 else if(now-x.openedAt>=4*60*60*1000){x.status='EXPIRED';x.r=risk?move/risk:0;x.closedAt=now;}
 changed=true;}if(changed)shadowSave(rows);
}
function allTrainingRows(real=[]){return real.concat(shadowLoad().filter(x=>x.status!=='OPEN'));}
function info(){const m=load();return{samples:m.n,ready:m.n>=MIN_LEARN,weights:Object.fromEntries(names.map((n,i)=>[n,m.w[i]])),lastLearned:m.lastLearned};}
return{review,learn,addShadow,updateShadow,allTrainingRows,info,probability,MIN_LEARN};
});