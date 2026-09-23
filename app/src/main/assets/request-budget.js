(function(root,f){const api=f();if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestBudget=api;})(globalThis,function(){
'use strict';
const DAY=86400000,DAILY_LIMIT=10000,QUOTE_INTERVAL=12000,FRAME_MS={M1:60000,M5:300000,H1:3600000,H4:14400000};
class Budget{
 constructor(storage,clock=Date.now,limit=DAILY_LIMIT){this.storage=storage;this.clock=clock;this.limit=limit;try{this.state=JSON.parse(storage?.getItem('market-ai-provider-budget-v1')||'null');}catch{}if(!this.state||!Number.isInteger(this.state.day)||!Number.isInteger(this.state.used)||this.state.used<0)this.state={day:Math.floor(clock()/DAY),used:0};this.until=0;}
 sync(){const day=Math.floor(this.clock()/DAY);if(day>this.state.day)this.state={day,used:0};try{this.storage?.setItem('market-ai-provider-budget-v1',JSON.stringify(this.state));}catch{}}
 remaining(){this.sync();return Math.max(0,this.limit-this.state.used);}
 take(){this.sync();if(this.clock()<this.until||this.state.used>=this.limit)return false;this.state.used++;this.sync();return true;}
 cooldown(status,retrySeconds){if(status!==429)return;const seconds=Number.isFinite(retrySeconds)&&retrySeconds>0?Math.min(86400,retrySeconds):300;this.until=Math.max(this.until,this.clock()+seconds*1000);}
 reason(){return this.remaining()===0?'DAILY_LIMIT':this.clock()<this.until?'RATE_LIMIT':null;}
}
function barDue(now,last,period,failed=false){if(!last)return true;if(failed)return now-last>=60000;return Math.floor((now-5000)/period)>Math.floor((last-5000)/period);}
return{Budget,DAILY_LIMIT,QUOTE_INTERVAL,FRAME_MS,barDue};
});
