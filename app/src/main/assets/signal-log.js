/* Local signal journal for Market AI Scalp AI V1.4. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SignalJournal=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const KEY='market_ai_scalp_v14_signals',MAX=500,TTL=4*60*60*1000;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
function save(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)));}catch{}}
function makeId(symbol,a,now){return [symbol,a.decision,a.opportunity,Math.round(a.trade.entry*1000),now].join('-');}
function add(symbol,a,now=Date.now()){
 if(!a||!['BUY','SELL'].includes(a.decision))return null;const rows=load();
 const dup=rows.find(x=>x.symbol===symbol&&x.status==='OPEN'&&x.side===a.decision&&x.type===a.opportunity&&Math.abs(x.entry-a.trade.entry)<=Math.max(.00001,Math.abs(a.trade.entry)*.00005));
 if(dup)return dup;
 for(const x of rows){if(x.symbol===symbol&&x.status==='OPEN'&&x.side!==a.decision){x.status='INVALIDATED';x.closedAt=now;}}
 const row={id:makeId(symbol,a,now),symbol,openedAt:now,closedAt:null,side:a.decision,type:a.opportunity,score:a.score,entryBasis:Array.isArray(a.meta?.entryBasis)?a.meta.entryBasis:[],entry:a.trade.entry,sl:a.trade.sl,tp1:a.trade.tp1,tp2:a.trade.tp2,tp3:a.trade.tp3,atr:a.meta?.atr||null,poi:a.poi||null,stages:a.stages,aiFeatures:a.meta?.aiFeatures||null,aiReview:a.aiReview||null,aiProbability:Number.isFinite(a.aiProbability)?a.aiProbability:null,status:'OPEN',highestTarget:null,maxFavorable:0,maxAdverse:0,r:0};rows.push(row);save(rows);return row;
}
function update(symbol,price,now=Date.now()){
 if(!(Number.isFinite(price)&&price>0))return;const rows=load();let changed=false;
 for(const x of rows){if(x.symbol!==symbol||x.status!=='OPEN')continue;const d=x.side==='BUY'?1:-1,risk=Math.abs(x.entry-x.sl),move=(price-x.entry)*d;x.maxFavorable=Math.max(x.maxFavorable,move);x.maxAdverse=Math.min(x.maxAdverse,move);
 if((price-x.tp3)*d>=0)x.highestTarget='TP3';else if((price-x.tp2)*d>=0&&!['TP3'].includes(x.highestTarget))x.highestTarget='TP2';else if((price-x.tp1)*d>=0&&!x.highestTarget)x.highestTarget='TP1';
 if(x.highestTarget==='TP3'){x.status='TP3';x.closedAt=now;x.r=1.8;}
 else if((price-x.sl)*d<=0){x.status=x.highestTarget||'SL';x.closedAt=now;x.r=x.highestTarget==='TP2'?1.25:x.highestTarget==='TP1'?.75:risk?-1:0;}
 else if(now-x.openedAt>=TTL){x.status=x.highestTarget||'EXPIRED';x.closedAt=now;x.r=x.highestTarget==='TP2'?1.25:x.highestTarget==='TP1'?.75:(risk?move/risk:0);}
 changed=true;
 }
 if(changed)save(rows);
}
function stats(filter){const rows=load().filter(x=>!filter||filter(x)),closed=rows.filter(x=>x.status!=='OPEN'),wins=closed.filter(x=>/^TP/.test(x.status));const pct=n=>closed.length?Math.round(n/closed.length*100):0;return{total:rows.length,closed:closed.length,winRate:pct(wins.length),tp1:pct(closed.filter(x=>x.status==='TP1').length),tp2:pct(closed.filter(x=>x.status==='TP2').length),tp3:pct(closed.filter(x=>x.status==='TP3').length),sl:pct(closed.filter(x=>x.status==='SL').length),avgR:closed.length?closed.reduce((s,x)=>s+(Number(x.r)||0),0)/closed.length:0};}
function csv(){const rows=load(),h=['id','symbol','openedAt','closedAt','side','type','score','entryBasis','aiReview','aiProbability','entry','sl','tp1','tp2','tp3','status','highestTarget','maxFavorable','maxAdverse','r'];return [h.join(','),...rows.map(x=>h.map(k=>JSON.stringify(x[k]??'')).join(','))].join('\n');}
function json(){return JSON.stringify(load(),null,2);}
return{load,add,update,stats,csv,json};
});