/* Observation journal, not executed trades. Policy is immutable per strategy version. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SignalJournal=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const KEY='market-ai.signal-history.v1';
const POLICY=Object.freeze({id:'observed-ticks-30m-v1',expiryMs:1800000,maxObservationGapMs:10000,quoteMaxAgeMs:5000,sourceMaxAgeMs:10000,terminalTarget:'TP3',costsIncluded:false});
const SYMBOLS=['XAUUSD','BTCUSD'],MODES=['PULLBACK','CONTINUATION'];
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const price=v=>finite(v)&&v>0;
function signalId(symbol,a){return [a.version,symbol,a.decision,a.triggerTime].join(':');}
function fresh(t,now){return t&&price(t.price)&&finite(t.receivedAt)&&now-t.receivedAt<=POLICY.quoteMaxAgeMs&&t.receivedAt<=now+5000&&(t.sourceAt===null||t.sourceAt===undefined||(finite(t.sourceAt)&&now-t.sourceAt<=POLICY.sourceMaxAgeMs&&t.sourceAt<=now+5000))&&(!t.marketState||['OPEN','TRADING','ACTIVE'].includes(t.marketState));}
function validateRecord(r){
 const nullableNumber=v=>v===null||finite(v),nonnegative=v=>finite(v)&&v>=0;
 if(!r||typeof r.id!=='string'||typeof r.version!=='string'||r.policyId!==POLICY.id||!SYMBOLS.includes(r.symbol)||!MODES.includes(r.opportunityType)||!['BUY','SELL'].includes(r.direction)||!['ACTIVE','CLOSED'].includes(r.status))return false;
 if(![r.entry,r.sl,r.tp1,r.tp2,r.tp3,r.atr,r.risk,r.lastPrice].every(price)||![r.createdAt,r.triggerTime,r.lastObservedAt,r.expiresAt,r.lastQuoteAt].every(finite)||![r.r,r.closedAt,r.exitPrice,r.lastSourceAt].every(nullableNumber)||![r.mfe,r.mae,r.mfeR,r.maeR,r.durationMs].every(nonnegative)||!finite(r.score)||r.score<70||r.score>100)return false;
 if(!r.hits||Object.keys(r.hits).length!==3||!['tp1','tp2','tp3'].every(k=>nullableNumber(r.hits[k]))||!Array.isArray(r.stages)||r.stages.length!==5||!['H4','H1','M15','M5','M1'].every(tf=>r.stages.filter(s=>s&&s.tf===tf&&typeof s.ok==='boolean'&&typeof s.text==='string').length===1))return false;
 if(!['ACTIVE','TP1','TP2','TP3','SL','EXPIRED','INVALIDATED'].includes(r.result)||!['OBSERVED_TICKS','INCOMPLETE'].includes(r.coverage)||typeof r.sourceTimeAvailable!=='boolean'||!['BULLISH','BEARISH','MIXED'].includes(r.macroBias)||!(r.closeReason===null||typeof r.closeReason==='string'))return false;
 if(r.poi!==null&&(!r.poi||![r.poi.low,r.poi.high,r.poi.atr,r.poi.time].every(price)||r.poi.high<=r.poi.low||![1,-1].includes(r.poi.direction)))return false;
 const d=r.direction==='BUY'?1:-1;
 return (r.entry-r.sl)*d>0&&(r.tp1-r.entry)*d>0&&(r.tp2-r.tp1)*d>0&&(r.tp3-r.tp2)*d>0&&(r.status==='ACTIVE'?r.closedAt===null&&r.r===null:finite(r.closedAt));
}
class Journal{
 constructor(storage){this.storage=storage;this.records=[];this.error='';this.readOnly=false;this.revision=0;this.rawCorrupt=null;
  try{const raw=storage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(data.schema!==1||!Array.isArray(data.records)||!data.records.every(validateRecord)||new Set(data.records.map(r=>r.id)).size!==data.records.length)throw Error('invalid history');this.records=data.records;}}
  catch(e){this.error='تعذر قراءة السجل؛ لم يتم استبدال البيانات. صدّر JSON للاحتفاظ بنسخة.';this.readOnly=true;try{this.rawCorrupt=storage.getItem(KEY);}catch{}}
 }
 flush(){if(this.readOnly)return false;try{this.storage.setItem(KEY,JSON.stringify({schema:1,records:this.records}));this.error='';return true;}catch(e){this.error='تعذر حفظ السجل على الجهاز. السجل الجديد مؤقت؛ صدّر نسخة الآن.';return false;}}
 get(id){return this.records.find(r=>r.id===id)||null;}
 record(symbol,a,now,tick){
  if(this.readOnly||!SYMBOLS.includes(symbol)||!a||!['BUY','SELL'].includes(a.decision)||!MODES.includes(a.opportunityType)||!finite(a.triggerTime)||!finite(a.score)||a.score<70||a.score>100||!price(a.atr)||!a.version||!finite(now))return null;
  const id=signalId(symbol,a),existing=this.get(id);if(existing)return existing;
  if(!fresh(tick,now))return null;
  if(!a.trade||!Object.values(a.trade).every(price)||!Array.isArray(a.stages)||!['H1','M15','M5','M1'].every(tf=>a.stages.some(s=>s.tf===tf&&s.ok))||a.macroConflict)return null;
  const {entry,sl,tp1,tp2,tp3}=a.trade,d=a.decision==='BUY'?1:-1;
  if(![sl,entry,tp1,tp2,tp3].every(price)||(entry-sl)*d<=0||(tp1-entry)*d<=0||(tp2-tp1)*d<=0||(tp3-tp2)*d<=0)return null;
  const r={id,version:a.version,policyId:POLICY.id,symbol,direction:a.decision,opportunityType:a.opportunityType,score:a.score,createdAt:now,triggerTime:a.triggerTime,stages:clone(a.stages),macroBias:a.macroBias,entry,sl,tp1,tp2,tp3,atr:a.atr,poi:a.poi?clone(a.poi):null,risk:Math.abs(entry-sl),expiresAt:now+POLICY.expiryMs,status:'ACTIVE',result:'ACTIVE',closeReason:null,closedAt:null,exitPrice:null,r:null,hits:{tp1:null,tp2:null,tp3:null},mfe:0,mae:0,mfeR:0,maeR:0,durationMs:0,lastObservedAt:now,lastQuoteAt:tick?.receivedAt??now,lastSourceAt:tick?.sourceAt??null,lastPrice:entry,sourceTimeAvailable:finite(tick?.sourceAt),coverage:'OBSERVED_TICKS'};
  this.records.push(r);this.revision++;this.flush();return r;
 }
 close(r,result,reason,at,p=null){r.status='CLOSED';r.result=result;r.closeReason=reason;r.closedAt=at;r.durationMs=Math.max(0,at-r.createdAt);r.exitPrice=p;r.r=price(p)?(p-r.entry)*(r.direction==='BUY'?1:-1)/r.risk:null;this.revision++;}
 sweep(now){let changed=false;for(const r of this.records){if(r.status==='ACTIVE'&&now-r.lastObservedAt>POLICY.maxObservationGapMs){this.close(r,'INVALIDATED','DATA_GAP',now);r.coverage='INCOMPLETE';changed=true;}}if(changed)this.flush();return changed;}
 observe(symbol,tick,now,context={}){
  // Never attribute price movements seen after an unobserved gap to a known target/stop order.
  this.sweep(now);if(!fresh(tick,now))return false;let changed=false;
  for(const r of this.records){if(r.symbol!==symbol||r.status!=='ACTIVE'||r.version!==context.version&&context.version!==undefined)continue;
   if(tick.receivedAt<=r.lastQuoteAt||(finite(tick.sourceAt)&&finite(r.lastSourceAt)&&tick.sourceAt<=r.lastSourceAt))continue;
   const at=tick.receivedAt;if(at<r.createdAt)continue;
   const d=r.direction==='BUY'?1:-1,p=tick.price,move=(p-r.entry)*d;
   r.lastObservedAt=at;r.lastQuoteAt=at;r.lastSourceAt=tick.sourceAt??null;r.lastPrice=p;r.durationMs=at-r.createdAt;
   r.mfe=Math.max(r.mfe,move);r.mae=Math.max(r.mae,-move);r.mfeR=r.mfe/r.risk;r.maeR=r.mae/r.risk;
   if(at>r.expiresAt)this.close(r,'EXPIRED','TIME_LIMIT_FIRST_OBSERVATION',at,p);
   else if((p-r.sl)*d<=0)this.close(r,'SL','STOP_OBSERVED',at,p);
   else{
    for(const key of ['tp1','tp2','tp3'])if(!r.hits[key]&&(p-r[key])*d>=0)r.hits[key]=at;
    if(r.hits.tp3)this.close(r,'TP3','TARGET_OBSERVED',at,p);
    else if(at>=r.expiresAt)this.close(r,'EXPIRED','TIME_LIMIT',at,p);
    else if(context.h1Direction===-d&&finite(context.h1Time)&&context.h1Time*1000>r.triggerTime*1000)this.close(r,'INVALIDATED','H1_REVERSAL',at,p);
    else r.result=r.hits.tp2?'TP2':r.hits.tp1?'TP1':'ACTIVE';
   }
   changed=true;this.revision++;
  }
  if(changed)this.flush();return changed;
 }
 filtered(filters={}){return this.records.filter(r=>Object.entries(filters).every(([k,v])=>!v||v==='ALL'||r[k]===v));}
 stats(filters={}){const all=this.filtered(filters),n=all.length,closed=all.filter(r=>r.status==='CLOSED'),measured=closed.filter(r=>finite(r.r)),mean=measured.length?measured.reduce((s,r)=>s+r.r,0)/measured.length:null;
  const percent=count=>n?100*count/n:null;
  return {total:n,active:n-closed.length,closed:closed.length,measured:measured.length,unknown:closed.length-measured.length,winRate:measured.length?100*measured.filter(r=>r.r>0).length/measured.length:null,tp1Rate:percent(all.filter(r=>r.hits.tp1!==null).length),tp2Rate:percent(all.filter(r=>r.hits.tp2!==null).length),tp3Rate:percent(all.filter(r=>r.hits.tp3!==null).length),slRate:percent(all.filter(r=>r.result==='SL').length),averageR:mean};
 }
 exportJSON(){return JSON.stringify({schema:1,exportedAt:new Date().toISOString(),policy:POLICY,measurement:'Observed external quotes; not executions; fees/spread/slippage not modelled. Missed intervals are unknown.',statisticsDenominators:{winRate:'Closed signals with known exit R; R>0 is a win',targetAndStopRates:'All recorded signals including active/incomplete; observed hits only',averageR:'Closed signals with known exit R only'},storageError:this.error||null,rawCorrupt:this.rawCorrupt,records:this.records},null,2);}
 exportCSV(){const keys=['id','version','policyId','symbol','createdAt','triggerTime','direction','opportunityType','score','stages','entry','sl','tp1','tp2','tp3','atr','poi','expiresAt','closedAt','status','result','closeReason','exitPrice','r','hits','mfe','mae','mfeR','maeR','durationMs','lastObservedAt','coverage','sourceTimeAvailable'];
  const cell=v=>{let s=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);if(typeof v==='string'&&/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[keys.join(','),...this.records.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');
 }
}
return {KEY,POLICY,Journal,signalId,fresh};
});
