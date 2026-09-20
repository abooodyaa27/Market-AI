/* Market AI on-device adaptive reviewer V1.6.
   Learns from engine signals AND independent AI missed-opportunity scouting. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AILearner=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const KEY='market_ai_scalp_ai_v16_model',SHADOW_KEY='market_ai_scalp_ai_v16_shadow',MISS_KEY='market_ai_scalp_ai_v16_missed',MIN_LEARN=15,LR=.04,L2=.0025;
const names=['bias','m15Align','m15Strength','m5Strength','stretch','score','isPullback','isContinuation','isMomentum','isReentry','isBreakout','isBreakoutRetest','isFakeBreak','isLiquiditySweep','isRangeRejection','isBTC','vol1','vol5','body1','body5','compression5','distanceEma','trendAge5','entryDistance'];
const num=(v,max=3)=>Math.max(-max,Math.min(max,Number(v)||0));
function sigmoid(z){return 1/(1+Math.exp(-Math.max(-12,Math.min(12,z))));}
function fresh(){return{version:4,n:0,w:[0,.10,.05,.12,-.12,.18,.04,.04,.03,.03,.03,.04,.02,.03,.02,0,-.03,-.02,.03,.03,-.04,-.06,.04,-.06],lastLearned:null};}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&Array.isArray(x.w)&&x.w.length===names.length?x:fresh();}catch{return fresh();}}
function save(m){try{localStorage.setItem(KEY,JSON.stringify(m));}catch{}}
function vec(candidate){const f=candidate?.meta?.aiFeatures||candidate?.aiFeatures||{};return[1,num(f.m15Align,1),num(f.m15Strength,1.5),num(f.m5Strength,1.5),num(f.stretch,2.5),num(f.score,1),f.isPullback?1:0,f.isContinuation?1:0,f.isMomentum?1:0,f.isReentry?1:0,f.isBreakout?1:0,f.isBreakoutRetest?1:0,f.isFakeBreak?1:0,f.isLiquiditySweep?1:0,f.isRangeRejection?1:0,f.isBTC?1:0,num(f.vol1,3),num(f.vol5,3),num(f.body1,3),num(f.body5,3),num(f.compression5,4),num(f.distanceEma,3),num(f.trendAge5,1),num(f.entryDistance,2)];}
function probability(candidate,m=load()){const x=vec(candidate);let z=0;for(let i=0;i<x.length;i++)z+=m.w[i]*x[i];return sigmoid(z);}
function labelFromRow(r){if(!r||r.status==='OPEN')return null;if(/^TP/.test(r.status)||r.status==='WIN')return 1;if(r.status==='SL'||r.status==='LOSS')return 0;if(r.status==='EXPIRED')return Number(r.r)>0?1:Number(r.r)<0?0:null;return null;}
function trainOne(m,candidate,y){const x=vec(candidate),p=probability(candidate,m),err=y-p;for(let i=0;i<m.w.length;i++)m.w[i]+=LR*(err*x[i]-L2*m.w[i]);m.n++;m.lastLearned=Date.now();}
function hydrateCandidate(row){return{meta:{aiFeatures:row.aiFeatures||{}},score:row.score||0,opportunity:row.type||null};}
function learn(rows=[]){const m=load(),learned=new Set(m.learnedIds||[]);for(const r of rows){const y=labelFromRow(r);if(y===null||learned.has(r.id)||!r.aiFeatures)continue;trainOne(m,hydrateCandidate(r),y);learned.add(r.id);}m.learnedIds=[...learned].slice(-2500);save(m);return m;}
function review(candidate){const m=load(),p=probability(candidate,m),enough=m.n>=MIN_LEARN;if(!enough)return{mode:'LEARNING',approve:true,prob:p,samples:m.n,reason:'AI يتعلم الآن ولا يمنع الإشارة قبل اكتمال عينات كافية.'};if(p>=.58)return{mode:'APPROVE',approve:true,prob:p,samples:m.n,reason:'AI وافق: الحالة تشبه فرصًا ناجحة سابقة.'};if(p<.42)return{mode:'REJECT',approve:false,prob:p,samples:m.n,reason:'AI رفض: الحالة تشبه فرصًا ضعيفة سابقة.'};return{mode:'CAUTION',approve:true,prob:p,samples:m.n,reason:'AI محايد: يسمح بالإشارة مع حذر.'};}
function shadowLoad(){try{const x=JSON.parse(localStorage.getItem(SHADOW_KEY)||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
function shadowSave(x){try{localStorage.setItem(SHADOW_KEY,JSON.stringify(x.slice(-500)));}catch{}}
function addShadow(symbol,candidate,review,now=Date.now()){if(!candidate||!['BUY','SELL'].includes(candidate.decision))return null;const rows=shadowLoad(),dup=rows.find(x=>x.status==='OPEN'&&x.symbol===symbol&&x.side===candidate.decision&&Math.abs(x.entry-candidate.trade.entry)<=Math.max(.00001,Math.abs(candidate.trade.entry)*.00005));if(dup)return dup;const r={id:'shadow-'+symbol+'-'+now,symbol,openedAt:now,closedAt:null,status:'OPEN',side:candidate.decision,type:candidate.opportunity,score:candidate.score,entry:candidate.trade.entry,sl:candidate.trade.sl,tp1:candidate.trade.tp1,tp2:candidate.trade.tp2,tp3:candidate.trade.tp3,r:0,aiReview:review?.mode||'REJECT',aiFeatures:candidate.meta?.aiFeatures||null};rows.push(r);shadowSave(rows);return r;}
function updateShadow(symbol,price,now=Date.now()){if(!(Number.isFinite(price)&&price>0))return;const rows=shadowLoad();let changed=false;for(const x of rows){if(x.symbol!==symbol||x.status!=='OPEN')continue;const d=x.side==='BUY'?1:-1,risk=Math.abs(x.entry-x.sl),move=(price-x.entry)*d;if((price-x.tp3)*d>=0){x.status='TP3';x.r=1.8;x.closedAt=now;}else if((price-x.sl)*d<=0){x.status='SL';x.r=-1;x.closedAt=now;}else if(now-x.openedAt>=4*60*60*1000){x.status='EXPIRED';x.r=risk?move/risk:0;x.closedAt=now;}changed=true;}if(changed)shadowSave(rows);}

function ema(a,n){if(a.length<n)return null;let v=a.slice(0,n).reduce((s,b)=>s+b[4],0)/n,k=2/(n+1);for(let i=n;i<a.length;i++)v+=k*(a[i][4]-v);return v;}
function atr(a,n=14){if(a.length<n+1)return null;let s=0;for(let i=a.length-n;i<a.length;i++)s+=Math.max(a[i][2]-a[i][3],Math.abs(a[i][2]-a[i-1][4]),Math.abs(a[i][3]-a[i-1][4]));return s/n;}
function missedLoad(){try{const x=JSON.parse(localStorage.getItem(MISS_KEY)||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
function missedSave(x){try{localStorage.setItem(MISS_KEY,JSON.stringify(x.slice(-1000)));}catch{}}
function scout(symbol,bars,tick,engineDecision,now=Date.now()){
 if(engineDecision!=='WAIT'||!tick||!Number.isFinite(tick.price))return null;
 const m5=bars?.M5||[],m1=bars?.M1||[],m15=bars?.M15||[];if(m5.length<30||m1.length<30||m15.length<30)return null;
 const a5=atr(m5),a1=atr(m1);if(!(a5>0&&a1>0))return null;
 const e9=ema(m5,9),e21=ema(m5,21),last5=m5.at(-1),last1=m1.at(-1),p=tick.price;
 let dir=e9>e21?1:e9<e21?-1:0;if(!dir)return null;
 const prev5=m5.slice(-9,-1),hi5=Math.max(...prev5.map(b=>b[2])),lo5=Math.min(...prev5.map(b=>b[3]));
 const prev1=m1.slice(-7,-1),hi1=Math.max(...prev1.map(b=>b[2])),lo1=Math.min(...prev1.map(b=>b[3]));
 const body5=(last5[4]-last5[1])*dir,body1=(last1[4]-last1[1])*dir;
 let type=null,reason=null,quality=0;
 const breakLevel=dir===1?hi5:lo5;
 if((p-breakLevel)*dir>.03*a5&&body5>.06*a5){type='AI_BREAKOUT';reason='AI رصد اختراقًا حيًا قبل اعتماد محرك القواعد';quality=.72;}
 const sweepLevel=dir===1?lo1:hi1;
 const swept=dir===1?last1[3]<sweepLevel-.02*a1:last1[2]>sweepLevel+.02*a1;
 const reclaimed=(last1[4]-sweepLevel)*dir>.01*a1;
 if(!type&&swept&&reclaimed){type='AI_LIQUIDITY_SWEEP';reason='AI رصد سحب سيولة واسترجاع مستوى على M1';quality=.69;}
 const mom=(last1[4]-prev1[0][4])*dir>.35*a1&&body1>.08*a1&&Math.abs(p-e9)<1.8*a5;
 if(!type&&mom){type='AI_MOMENTUM';reason='AI رصد زخمًا متسارعًا داخل اتجاه M5';quality=.66;}
 const nearEma=Math.abs(p-e9)<=.35*a5;
 if(!type&&nearEma&&body1>.05*a1){type='AI_PULLBACK';reason='AI رصد تصحيحًا قرب EMA ثم عودة الحركة مع الاتجاه';quality=.63;}
 if(!type)return null;
 const entry=p,sl=entry-dir*Math.max(.55*a1,.18*a5),risk=Math.abs(entry-sl);
 const candidate={decision:dir===1?'BUY':'SELL',opportunity:type,score:Math.round(quality*100),trade:{entry,sl,tp1:entry+dir*risk*.75,tp2:entry+dir*risk*1.25,tp3:entry+dir*risk*1.8},meta:{entryBasis:[reason],aiFeatures:{m15Align:0,m15Strength:0,m5Strength:Math.min(1.5,Math.abs(e9-e21)/a5),stretch:Math.abs(p-e9)/a5,score:quality,isPullback:type==='AI_PULLBACK'?1:0,isContinuation:0,isMomentum:type==='AI_MOMENTUM'?1:0,isReentry:0,isBreakout:type==='AI_BREAKOUT'?1:0,isBreakoutRetest:0,isFakeBreak:0,isLiquiditySweep:type==='AI_LIQUIDITY_SWEEP'?1:0,isRangeRejection:0,isBTC:symbol==='BTCUSD'?1:0,vol1:(last1[2]-last1[3])/a1,vol5:(last5[2]-last5[3])/a5,body1:Math.abs(last1[4]-last1[1])/a1,body5:Math.abs(last5[4]-last5[1])/a5,compression5:(hi5-lo5)/a5,distanceEma:Math.abs(p-e9)/a5,trendAge5:Math.min(1,Math.abs(m5.at(-1)[4]-m5.at(-10)[4])/a5/4),entryDistance:0}}};
 const rows=missedLoad(),bucket=Math.floor(now/60000);
 const dup=rows.find(x=>x.status==='OPEN'&&x.symbol===symbol&&x.side===candidate.decision&&x.type===type&&x.bucket===bucket);if(dup)return dup;
 const r={id:'missed-'+symbol+'-'+now,bucket,symbol,side:candidate.decision,type,reason,openedAt:now,closedAt:null,status:'OPEN',entry,sl,tp1:candidate.trade.tp1,tp2:candidate.trade.tp2,tp3:candidate.trade.tp3,maxFavorablePct:0,maxAdversePct:0,highestTarget:null,r:0,successPct:0,score:candidate.score,aiFeatures:candidate.meta.aiFeatures};
 rows.push(r);missedSave(rows);return r;
}
function updateMissed(symbol,price,now=Date.now()){
 if(!(Number.isFinite(price)&&price>0))return;const rows=missedLoad();let changed=false;
 for(const x of rows){if(x.symbol!==symbol||x.status!=='OPEN')continue;const d=x.side==='BUY'?1:-1,risk=Math.abs(x.entry-x.sl),move=(price-x.entry)*d,pct=move/x.entry*100;x.maxFavorablePct=Math.max(x.maxFavorablePct,pct);x.maxAdversePct=Math.min(x.maxAdversePct,pct);
 if((price-x.tp3)*d>=0)x.highestTarget='TP3';else if((price-x.tp2)*d>=0&&x.highestTarget!=='TP3')x.highestTarget='TP2';else if((price-x.tp1)*d>=0&&!x.highestTarget)x.highestTarget='TP1';
 if(x.highestTarget==='TP3'){x.status='WIN';x.r=1.8;x.successPct=x.maxFavorablePct;x.closedAt=now;}
 else if((price-x.sl)*d<=0){x.status='LOSS';x.r=-1;x.successPct=x.maxFavorablePct;x.closedAt=now;}
 else if(now-x.openedAt>=3*60*60*1000){x.status=move>0?'WIN':'LOSS';x.r=risk?move/risk:0;x.successPct=x.maxFavorablePct;x.closedAt=now;}
 changed=true;}if(changed)missedSave(rows);
}
function missedStats(symbol){const rows=missedLoad().filter(x=>!symbol||x.symbol===symbol),closed=rows.filter(x=>x.status!=='OPEN'),wins=closed.filter(x=>x.status==='WIN');return{total:rows.length,closed:closed.length,wins:wins.length,losses:closed.length-wins.length,winRate:closed.length?Math.round(wins.length/closed.length*100):0,avgMove:closed.length?closed.reduce((s,x)=>s+(Number(x.maxFavorablePct)||0),0)/closed.length:0};}
function allTrainingRows(real=[]){return real.concat(shadowLoad().filter(x=>x.status!=='OPEN')).concat(missedLoad().filter(x=>x.status!=='OPEN'));}
function info(){const m=load();return{samples:m.n,ready:m.n>=MIN_LEARN,weights:Object.fromEntries(names.map((n,i)=>[n,m.w[i]])),lastLearned:m.lastLearned};}
return{review,learn,addShadow,updateShadow,allTrainingRows,info,probability,MIN_LEARN,scout,updateMissed,missedLoad,missedStats};
});