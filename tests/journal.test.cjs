const test=require('node:test'),assert=require('node:assert/strict');
const mem={};global.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=v};
const J=require('../app/src/main/assets/signal-log.js');
function a(side='BUY'){return{decision:side,opportunity:'PULLBACK',score:82,trade:side==='BUY'?{entry:100,sl:98,tp1:102,tp2:103.5,tp3:105}:{entry:100,sl:102,tp1:98,tp2:96.5,tp3:95},meta:{atr:1},poi:null,stages:[]};}
test('journal avoids duplicate open signal',()=>{J.add('XAUUSD',a(),1000);J.add('XAUUSD',a(),1100);assert.equal(J.load().length,1);});
test('journal records final TP3 and stats',()=>{J.update('XAUUSD',105,1200);assert.equal(J.load()[0].status,'TP3');assert.equal(J.stats().winRate,100);});
test('opposite signal invalidates open prior signal',()=>{J.add('BTCUSD',a(),2000);J.add('BTCUSD',a('SELL'),2100);const r=J.load().filter(x=>x.symbol==='BTCUSD');assert.equal(r[0].status,'INVALIDATED');assert.equal(r[1].status,'OPEN');});
