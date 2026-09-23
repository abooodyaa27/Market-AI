(function(root,f){const api=f(typeof module==='object'?require('./risk-engine'):root.RiskSafety);if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketLiveFeed=api;})(globalThis,function(R){
'use strict';
function priceState(tick,now){return R.preflight({tick,now}).ok?'LIVE':tick?'UNSAFE / WAIT':'CONNECTING';}
class LiveFeed{
 constructor(hub,onTick,clock=Date.now){this.hub=hub;this.onTick=onTick;this.clock=clock;this.symbol=null;this.subscribed=null;this.lastTick=0;this.starting=null;
  hub.on('ReceiveTick',tick=>{if(tick?.symbol!==this.symbol)return;this.lastTick=this.clock();this.onTick(tick);});
  hub.onreconnected(()=>this.resubscribe());
  hub.onclose(()=>{this.subscribed=null;this.lastTick=0;});
 }
 async resubscribe(){if(this.hub.state!=='Connected'||!this.symbol)return;this.lastTick=0;await this.hub.invoke('Subscribe',[this.symbol]);this.subscribed=this.symbol;}
 async start(){if(this.hub.state==='Connected'){if(this.subscribed!==this.symbol)await this.resubscribe();return;}if(this.starting)return this.starting;this.starting=(async()=>{await this.hub.start();await this.resubscribe();})().finally(()=>{this.starting=null;});return this.starting;}
 async select(symbol){if(!['XAUUSD','BTCUSD'].includes(symbol)||this.symbol===symbol)return;const previous=this.subscribed;this.symbol=symbol;this.lastTick=0;if(this.hub.state!=='Connected')return;if(previous){await this.hub.invoke('Unsubscribe',[previous]);this.subscribed=null;}await this.resubscribe();}
 needsFallback(){return this.hub.state!=='Connected'||!this.lastTick||this.clock()-this.lastTick>10000;}
}
return{LiveFeed,priceState};
});
