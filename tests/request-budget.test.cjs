const test=require('node:test'),assert=require('node:assert/strict');
const {Budget,barDue,FRAME_MS,QUOTE_INTERVAL,DAILY_LIMIT}=require('../app/src/main/assets/request-budget');
const DAY=86400000;
test('daily request cap persists across reload and cannot be reset by rolling clock back',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 let now=2*DAY+1000,b=new Budget(storage,()=>now,3);
 assert.equal(b.take(),true);assert.equal(b.take(),true);
 b=new Budget(storage,()=>now,3);assert.equal(b.remaining(),1);assert.equal(b.take(),true);assert.equal(b.take(),false);
 now-=DAY;assert.equal(b.take(),false);
 now+=2*DAY;assert.equal(b.take(),true);assert.equal(b.remaining(),2);
});
test('HTTP 429 blocks requests through retry-after while retaining the daily count',()=>{
 let now=DAY+1000;const b=new Budget(null,()=>now,3);
 assert.equal(b.take(),true);b.cooldown(429,12);assert.equal(b.take(),false);
 now+=12000;assert.equal(b.take(),true);assert.equal(b.remaining(),1);
});
test('frames are fetched once after each close and failed requests use a bounded retry',()=>{
 const minute=60000,now=10*minute+5000;
 assert.equal(barDue(now,0,minute),true);
 assert.equal(barDue(now+1000,now,minute),false);
 assert.equal(barDue(now+minute,now,minute),true);
 assert.equal(barDue(now+30000,now,minute,true),false);
 assert.equal(barDue(now+60000,now,minute,true),true);
});
test('one selected asset fits within the daily cap over a full day; inactive asset makes no calls',()=>{
 let used=0,lastTick=-QUOTE_INTERVAL,frameAttempts={};
 for(let now=5000;now<DAY;now+=1000){
  if(now-lastTick>=QUOTE_INTERVAL){used++;lastTick=now;}
  for(const [frame,period] of Object.entries(FRAME_MS))if(barDue(now,frameAttempts[frame]||0,period)){
   used++;frameAttempts[frame]=now;
  }
 }
 assert.ok(used<=DAILY_LIMIT,`${used} requests exceed the daily cap`);
 assert.ok(used>8000,'exercise real quote and bar cadence');
});
