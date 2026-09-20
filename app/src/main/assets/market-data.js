(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketData=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const TF={H4:14400,H1:3600,M15:900,M5:300,M3:180,M1:60};
const number=v=>v===null||v===undefined||typeof v==='boolean'||String(v).trim()===''?NaN:Number(v);
const positive=v=>Number.isFinite(v)&&v>0;
function timestamp(v){if(v===null||v===undefined||v==='')return null;let n=Number(v);if(Number.isFinite(n))return n<1e11?n*1000:n;const t=Date.parse(v);return Number.isFinite(t)?t:NaN;}
function normalizeTick(raw,now){if(!raw||typeof raw!=='object')return null;const bid=number(raw.bid),ask=number(raw.ask),mid=number(raw.mid);const price=positive(mid)?mid:positive(bid)&&positive(ask)?(bid+ask)/2:positive(bid)?bid:ask;if(!positive(price))return null;
 const sourceAt=timestamp(raw.timestamp??raw.updatedAt??raw.time??raw.quoteTime??raw.lastUpdate);
 return {price,receivedAt:now,sourceAt,marketState:String(raw.marketState||'').toUpperCase()};
}
function normalizeBars(raw,tf){if(!TF[tf]||!raw||!Array.isArray(raw.bars))throw Error('Invalid OHLC response');const map=new Map();for(const b of raw.bars){const t=timestamp(b.openTime),v=[t/1000,number(b.open),number(b.high),number(b.low),number(b.close),b.isOpen===true||b.isOpen==='true'];
 if(!positive(t)||!v.slice(1,5).every(positive)||v[2]<Math.max(v[1],v[3],v[4])||v[3]>Math.min(v[1],v[4]))continue;
 map.set(v[0],v);}return Array.from(map.values()).sort((a,b)=>a[0]-b[0]).slice(-160);}
function patchLive(a,p,now,tf){if(!positive(p)||!Number.isFinite(now)||!TF[tf]||!a.length)return a;const bucket=Math.floor(now/1000/TF[tf])*TF[tf],out=a.map(b=>b.slice()),last=out[out.length-1];
 if(last[0]>bucket)return a;
 if(last[0]===bucket){last[2]=Math.max(last[2],p);last[3]=Math.min(last[3],p);last[4]=p;last[5]=true;}
 else out.push([bucket,p,p,p,p,true]);
 return out.slice(-160);
}
function aggregate(a,seconds){if(!Array.isArray(a)||!a.length)return[];const m=new Map();for(const b of a){const t=Math.floor(b[0]/seconds)*seconds;let g=m.get(t);if(!g){g=[t,b[1],b[2],b[3],b[4],!!b[5],b[6]??0];m.set(t,g);}else{g[2]=Math.max(g[2],b[2]);g[3]=Math.min(g[3],b[3]);g[4]=b[4];g[5]=g[5]||!!b[5];g[6]=(g[6]||0)+(b[6]||0);}}return Array.from(m.values()).sort((x,y)=>x[0]-y[0]).slice(-160);}
return {TF,normalizeTick,normalizeBars,patchLive,aggregate};
});
