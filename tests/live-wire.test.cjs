const test=require('node:test'),assert=require('node:assert/strict');
const {Server:WebSocketServer}=require('ws'),signalR=require('@microsoft/signalr');
const {LiveFeed}=require('../app/src/main/assets/live-feed');
test('real SignalR client receives ticks without a REST request and subscribes to gold only',async()=>{
 const server=new WebSocketServer({port:0,host:'127.0.0.1'}),seen=[],calls=[];
 await new Promise(r=>server.once('listening',r));
 server.on('connection',ws=>{ws.on('message',bytes=>{for(const part of String(bytes).split('\x1e').filter(Boolean)){const msg=JSON.parse(part);if(msg.protocol){ws.send('{}\x1e');continue;}if(msg.target==='Subscribe'){calls.push(msg.arguments);ws.send(JSON.stringify({type:3,invocationId:msg.invocationId})+'\x1e');ws.send(JSON.stringify({type:1,target:'ReceiveTick',arguments:[{symbol:'XAUUSD',bid:100,ask:100.1,mid:100.05,timestamp:new Date().toISOString()}]})+'\x1e');}}});});
 const hub=new signalR.HubConnectionBuilder().withUrl(`http://127.0.0.1:${server.address().port}/hubs/tick`,{transport:signalR.HttpTransportType.WebSockets,skipNegotiation:true,withCredentials:false}).build();
 try{const feed=new LiveFeed(hub,t=>seen.push(t));await feed.select('XAUUSD');await feed.start();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clearInterval(poll);reject(Error('tick not received'));},3000);const poll=setInterval(()=>{if(seen.length){clearTimeout(timer);clearInterval(poll);resolve();}},10);});assert.deepEqual(calls,[[['XAUUSD']]]);assert.equal(seen[0].mid,100.05);assert.equal(feed.needsFallback(),false);}finally{await hub.stop();await new Promise(r=>server.close(r));}
});
