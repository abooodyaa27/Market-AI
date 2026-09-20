/* Local signal journal for Market AI V2.1. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SignalJournal=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const KEY='market_ai_v21_signals',MAX=500;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
function save(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)));}catch{}}
function id(symbol,a){return [symbol,a.decision,a.opportunity,Math.round(a.trade.entry*1000),Date.now()].join('-');}
function add(symbol,a,now=Date.now()){if(!a||!['BUY','SELL'].includes(a.decision))return null;const rows=load();const recent=rows.find(x=>x.symbol===symbol&&x.status==='OPEN'&&x.side===a.decision&&Math.abs(x.entry-a.trade.entry)<=Math.max(.00001,Math.abs(a.trade.entry)*.00005));if(recent)return recent;
 const row={id:id(symbol,a),symbol,openedAt:now,closedAt:null,side:a.decision,type:a.opportunity,score:a.score,entry:a.trade.entry,sl:a.trade.sl,tp1:a.trade.tp1,tp2:a.trade.tp2,tp3:a.trade.tp3,atr:a.meta?.atr||null,poi:a.poi||null,stages:a.stages,status:'OPEN',maxFavorable:0,maxAdverse:0,r:0};rows.push(row);save(rows);return row;}
function update(symbol,price,now=Date.now()){if(!(Number.isFinite(price)&&price>0))return;const rows=load();let changed=false;for(const x of rows){if(x.symbol!==symbol||x.status!=='OPEN')continue;const d=x.side==='BUY'?1:-1,risk=Math.abs(x.entry-x.sl);const move=(price-x.entry)*d;x.maxFavorable=Math.max(x.maxFavorable,move);x.maxAdverse=Math.min(x.maxAdverse,move);let status=null;
 if((price-x.sl)*d<=0)status='SL';else if((price-x.tp3)*d>=0)status='TP3';else if((price-x.tp2)*d>=0)status='TP2';else if((price-x.tp1)*d>=0)status='TP1';
 if(status){x.status=status;x.closedAt=now;x.r=risk?((price-x.entry)*d/risk):0;}changed=true;}if(changed)save(rows);}
function stats(filter){const rows=load().filter(x=>!filter||filter(x)),closed=rows.filter(x=>x.status!=='OPEN'),wins=closed.filter(x=>/^TP/.test(x.status));const pct=n=>closed.length?Math.round(n/closed.length*100):0;return{total:rows.length,closed:closed.length,winRate:pct(wins.length),tp1:pct(closed.filter(x=>x.status==='TP1').length),tp2:pct(closed.filter(x=>x.status==='TP2').length),tp3:pct(closed.filter(x=>x.status==='TP3').length),sl:pct(closed.filter(x=>x.status==='SL').length),avgR:closed.length?closed.reduce((s,x)=>s+(Number(x.r)||0),0)/closed.length:0};}
function csv(){const rows=load(),h=['id','symbol','openedAt','closedAt','side','type','score','entry','sl','tp1','tp2','tp3','status','r'];return [h.join(','),...rows.map(x=>h.map(k=>JSON.stringify(x[k]??'')).join(','))].join('\n');}
function json(){return JSON.stringify(load(),null,2);}
return{load,add,update,stats,csv,json};
});