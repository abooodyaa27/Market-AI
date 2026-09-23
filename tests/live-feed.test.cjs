const test=require('node:test'),assert=require('node:assert/strict');
const {LiveFeed,priceState}=require('../app/src/main/assets/live-feed');
function hub(){const h={state:'Disconnected',events:{},calls:[],on(name,fn){this.events[name]=fn;},onreconnected(fn){this.reconnected=fn;},onclose(fn){this.closed=fn;},async start(){this.state='Connected';},async invoke(...args){this.calls.push(args);},async stop(){this.state='Disconnected';}};return h;}
test('subscribes only the selected asset, forwards ticks and switches symbols',async()=>{
 const h=hub(),seen=[],feed=new LiveFeed(h,t=>seen.push(t));
 await feed.select('XAUUSD');await feed.start();
 assert.deepEqual(h.calls,[['Subscribe',['XAUUSD']]]);
 h.events.ReceiveTick({symbol:'BTCUSD',mid:1});h.events.ReceiveTick({symbol:'XAUUSD',mid:2});
 assert.deepEqual(seen.map(t=>t.mid),[2]);
 await feed.select('BTCUSD');
 assert.deepEqual(h.calls.slice(1),[['Unsubscribe',['XAUUSD']],['Subscribe',['BTCUSD']]]);
 await h.reconnected();assert.deepEqual(h.calls.at(-1),['Subscribe',['BTCUSD']]);
});
test('REST fallback becomes due when stream disconnects or stops delivering ticks',async()=>{
 let now=100000,h=hub(),feed=new LiveFeed(h,()=>{},()=>now);
 await feed.select('XAUUSD');await feed.start();h.events.ReceiveTick({symbol:'XAUUSD',mid:2});
 assert.equal(feed.needsFallback(),false);
 now+=11000;assert.equal(feed.needsFallback(),true);
 h.state='Disconnected';assert.equal(feed.needsFallback(),true);
});
test('fresh price remains LIVE with a blocked H1 signal, stale price does not',()=>{
 const tick={bid:100,ask:100.1,price:100.05,receivedAt:10000,sourceAt:10000,marketState:'OPEN'};
 assert.equal(priceState(tick,11000,{reason:'GAP_H1'}),'LIVE');
 assert.equal(priceState(tick,16000,{reason:'GAP_H1'}),'UNSAFE / WAIT');
});
