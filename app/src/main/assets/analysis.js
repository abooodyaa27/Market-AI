/* Market AI SCALP AI V1.3 — adaptive market-state learner + missed-entry recovery. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketAnalysis=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const TF={M15:900,M5:300,M1:60},FRAMES=['M15','M5','M1'];
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function formatPrice(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return '—';const n=Number(v);return positive(n)?n.toFixed(n>=10000?2:3):'—';}
function validBar(b){return Array.isArray(b)&&b.length>=5&&positive(b[0])&&b.slice(1,5).every(positive)&&b[2]>=Math.max(b[1],b[3],b[4])&&b[3]<=Math.min(b[1],b[4]);}
function atr(a,n=14){if(a.length<n+1)return null;let sum=0;for(let i=a.length-n;i<a.length;i++)sum+=Math.max(a[i][2]-a[i][3],Math.abs(a[i][2]-a[i-1][4]),Math.abs(a[i][3]-a[i-1][4]));return sum/n;}
function ema(a,n){if(a.length<n)return [];let v=a.slice(0,n).reduce((s,b)=>s+b[4],0)/n;const out=[v],k=2/(n+1);for(let i=n;i<a.length;i++){v+=k*(a[i][4]-v);out.push(v);}return out;}
function swings(a){const hs=[],ls=[];for(let i=2;i<a.length-2;i++){const b=a[i],near=a.slice(i-2,i+3);if(near.every((v,j)=>j===2||b[2]>=v[2])&&b[2]>a[i-1][2]&&b[2]>a[i+1][2])hs.push({i,price:b[2],bar:b});if(near.every((v,j)=>j===2||b[3]<=v[3])&&b[3]<a[i-1][3]&&b[3]<a[i+1][3])ls.push({i,price:b[3],bar:b});}return{hs,ls};}
function trend(a){
 const v=atr(a),e9=ema(a,9),e21=ema(a,21);if(!positive(v)||!e9.length||!e21.length)return{direction:0,strength:0,label:'بيانات غير كافية'};
 const f=e9.at(-1),s=e21.at(-1),p=a.at(-1)[4],delta=(a.at(-1)[4]-a.at(-8)[4])/v,slope=(f-e9.at(-4))/v;
 let direction=0;if(delta>.035&&slope>.012&&p>=s-.18*v)direction=1;if(delta<-.035&&slope<-.012&&p<=s+.18*v)direction=-1;
 const strength=Math.min(1.5,Math.abs(f-s)/v+Math.abs(delta)*.35+Math.abs(slope)*.25);
 return{direction,strength,atr:v,fast:f,slow:s,delta,slope,label:direction===1?'اتجاه صاعد':direction===-1?'اتجاه هابط':'محايد'};
}
function findPOI(a,dir){
 const v=atr(a);if(!positive(v)||!dir)return null;const sw=swings(a),pivots=(dir===1?sw.ls:sw.hs).filter(p=>p.i>=a.length-24);
 for(let j=pivots.length-1;j>=0;j--){const p=pivots[j],b=p.bar;let low,high;if(dir===1){low=b[3]-.08*v;high=Math.min(Math.min(b[1],b[4])+.12*v,low+.9*v);}else{high=b[2]+.08*v;low=Math.max(Math.max(b[1],b[4])-.12*v,high-.9*v);}const after=a.slice(p.i+1),invalid=after.some(x=>dir===1?x[4]<low-.12*v:x[4]>high+.12*v),impulse=after.some(x=>dir===1?x[4]>high+.16*v:x[4]<low-.16*v);if(!invalid&&impulse&&low>0&&high>low)return{low,high,atr:v,time:b[0],direction:dir};}return null;
}
function continuation(a,dir){
 const v=atr(a);if(!positive(v)||a.length<25)return null;const e=ema(a,9).at(-1),last=a.at(-1),recent=a.slice(-6),range=Math.max(...recent.map(b=>b[2]))-Math.min(...recent.map(b=>b[3])),body=(last[4]-last[1])*dir,progress=(last[4]-recent[0][4])*dir;
 if(range<=3*v&&(last[4]-e)*dir>=-.22*v&&body>=.06*v&&progress>=.09*v)return{type:'CONTINUATION',atr:v,low:Math.min(...recent.map(b=>b[3])),high:Math.max(...recent.map(b=>b[2])),time:recent[0][0]};return null;
}
function momentum(a,dir){
 const v=atr(a);if(!positive(v)||a.length<20)return null;
 const recent=a.slice(-8),last=a.at(-1),prev=recent.slice(0,-1),e9=ema(a,9).at(-1),body=(last[4]-last[1])*dir,range=last[2]-last[3],progress=(last[4]-recent[0][4])*dir;
 const breakLevel=dir===1?Math.max(...prev.map(b=>b[2])):Math.min(...prev.map(b=>b[3]));
 const broke=(last[4]-breakLevel)*dir>.08*v,notHuge=range<=2.3*v,trendSide=(last[4]-e9)*dir>0,impulse=body>=.18*v&&progress>=.45*v;
 if(broke&&notHuge&&trendSide&&impulse)return{type:'MOMENTUM',atr:v,breakLevel,time:last[0],low:Math.min(...recent.map(b=>b[3])),high:Math.max(...recent.map(b=>b[2]))};
 return null;
}
function marketFeatures(m15,m5,m1,dir,p,e5,a5,a1){
 const last1=m1.at(-1),last5=m5.at(-1),recent1=m1.slice(-8),recent5=m5.slice(-8);
 const vol1=(recent1.reduce((s,b)=>s+(b[2]-b[3]),0)/recent1.length)/a1;
 const vol5=(recent5.reduce((s,b)=>s+(b[2]-b[3]),0)/recent5.length)/a5;
 const body1=Math.abs(last1[4]-last1[1])/a1,body5=Math.abs(last5[4]-last5[1])/a5;
 const compression5=(Math.max(...recent5.map(b=>b[2]))-Math.min(...recent5.map(b=>b[3])))/a5;
 const distanceEma=Math.abs(p-e5)/a5;
 const trendAge5=Math.min(1,Math.abs((m5.at(-1)[4]-m5.at(-12)[4])/a5)/4);
 return{vol1,vol5,body1,body5,compression5,distanceEma,trendAge5};
}
function analyze(input){
 const{bars={},tick={},now=Date.now()}=input||{},result={decision:'WAIT',bias:'MIXED',score:0,opportunity:null,waitCode:'DATA',why:'لا توجد صفقة حالياً.',poi:null,trade:{entry:null,sl:null,tp1:null,tp2:null,tp3:null},stages:FRAMES.map(tf=>({tf,ok:false,score:0,text:'بانتظار البيانات'})),meta:{}};
 const stop=(code,m)=>{result.waitCode=code;result.score=result.stages.reduce((s,x)=>s+(Number(x.score)||0),0);result.why='لا توجد صفقة حالياً. '+m;return result;};
 if(!positive(tick.price)||!Number.isFinite(tick.receivedAt)||now-tick.receivedAt>5000||tick.receivedAt>now+5000)return stop('DATA','الأسعار غير متاحة أو غير حديثة.');
 if(tick.sourceAt!==null&&tick.sourceAt!==undefined&&(!Number.isFinite(tick.sourceAt)||now-tick.sourceAt>10000||tick.sourceAt>now+5000))return stop('STALE','وقت سعر المصدر غير حديث.');
 if(tick.marketState&&!['OPEN','TRADING','ACTIVE'].includes(String(tick.marketState).toUpperCase()))return stop('CLOSED','السوق مغلق أو حالته غير مؤكدة.');
 const closed={};for(const tf of FRAMES){const a=bars[tf];if(!Array.isArray(a)||a.length<55||a.some((b,i)=>!validBar(b)||(i>0&&b[0]<=a[i-1][0])))return stop('DATA','بيانات '+tf+' ناقصة أو غير صالحة.');closed[tf]=a.filter(b=>b[5]!==true&&(b[0]+TF[tf])*1000<=now);const c=closed[tf];if(c.length<55)return stop('DATA','ننتظر شموعاً مغلقة كافية على '+tf+'.');const bucket=Math.floor(now/1000/TF[tf])*TF[tf];if(c.at(-1)[0]!==bucket-TF[tf])return stop('DATA','ننتظر آخر شمعة مغلقة على '+tf+'.');const span=tf==='M1'?6:tf==='M5'?5:3,tail=c.slice(-span);if(tail.some((b,i)=>i>0&&b[0]-tail[i-1][0]!==TF[tf]))return stop('DATA','توجد فجوة في بيانات '+tf+'.');}
 const m15=trend(closed.M15),m5t=trend(closed.M5),dir=m5t.direction;if(!dir)return stop('M5_TREND','اتجاه M5 التنفيذي غير واضح.');
 const strongOpp=m15.direction===-dir&&m15.strength>=.75;if(strongOpp)return stop('M15_CONFLICT','M15 قوي بعكس اتجاه M5.');
 result.bias=m15.direction===1?'BULLISH':m15.direction===-1?'BEARISH':'MIXED';
 const m15Score=m15.direction===dir?30:m15.direction===0?15:8;
 result.stages[0]={tf:'M15',ok:!strongOpp,score:m15Score,text:m15.direction===dir?m15.label+' • متوافق':m15.direction===0?'محايد • لا يمنع السكالب':'عكس M5 لكن ضعيف'};
 const m5=closed.M5,p=tick.price,a5=atr(m5),e5=ema(m5,9).at(-1),b5=m5.at(-1),body5=(b5[4]-b5[1])*dir,progress5=(b5[4]-m5.at(-2)[4])*dir;
 let opp=null,zone=findPOI(m5,dir);
 if(zone){const near=p>=zone.low-.28*zone.atr&&p<=zone.high+.28*zone.atr,touch=m5.slice(-5).some(b=>b[3]<=zone.high+.2*zone.atr&&b[2]>=zone.low-.2*zone.atr);if(near&&touch&&body5>=.05*a5&&progress5>=0){opp='PULLBACK';result.poi=zone;}}
 if(!opp){const cont=continuation(m5,dir),trendContinuation=Math.abs(p-e5)<=1.2*a5&&body5>=.04*a5&&progress5>=0&&(b5[4]-e5)*dir>=-.08*a5;if(cont||trendContinuation){opp='CONTINUATION';result.poi=cont||{type:'CONTINUATION',atr:a5,low:Math.min(...m5.slice(-6).map(b=>b[3])),high:Math.max(...m5.slice(-6).map(b=>b[2])),time:m5.at(-6)[0]};}}
 if(!opp){const mom=momentum(m5,dir);if(mom){opp='MOMENTUM';result.poi=mom;}}
 result.opportunity=opp;const setup=!!opp&&(b5[2]-b5[3])<=2.3*a5;
 result.stages[1]={tf:'M5',ok:setup,score:setup?40:0,text:setup?(opp+' • Setup مؤكد'):'ننتظر Pullback أو Continuation أو Momentum على M5'};if(!setup)return stop('M5','لا توجد فرصة M5 صالحة الآن.');
 const m1=closed.M1,last=m1.at(-1),previous=m1.slice(-5,-1),a1=atr(m1),level=dir===1?Math.max(...previous.map(b=>b[2])):Math.min(...previous.map(b=>b[3]));
 let trigger=(last[4]-level)*dir>.02*a1&&(last[4]-last[1])*dir>=.08*a1&&(last[2]-last[3])<=2.2*a1,entryDistance=Math.abs(p-last[4])/a1,entryOK=(p-level)*dir>0&&entryDistance<=.45;
 if(opp==='MOMENTUM'){
   const prior=m1.slice(-7,-1),microExtreme=dir===1?Math.min(...prior.map(b=>b[3])):Math.max(...prior.map(b=>b[2])),pullbackDepth=Math.abs(microExtreme-level);
   const hadMicroPullback=pullbackDepth>=.18*a1;
   trigger=hadMicroPullback&&(last[4]-level)*dir>.015*a1&&(last[4]-last[1])*dir>=.06*a1;
   entryDistance=Math.abs(p-last[4])/a1;entryOK=(p-level)*dir>0&&entryDistance<=.35;
 }
 const missed=trigger&&!entryOK;
 if(missed){
   const re=m1.slice(-8),e1=ema(m1,9).at(-1),last2=m1.at(-1),prev2=m1.at(-2);
   const pulledBack=(last2[3]-e1)*dir<=.12*a1||(prev2[3]-e1)*dir<=.12*a1;
   const resumed=(last2[4]-prev2[4])*dir>.02*a1&&(last2[4]-last2[1])*dir>.05*a1;
   const notExtended=Math.abs(p-e1)<=.9*a1;
   if(pulledBack&&resumed&&notExtended){
     opp='REENTRY';result.opportunity='REENTRY';trigger=true;entryOK=true;entryDistance=Math.abs(p-last2[4])/a1;
   }
 }
 result.stages[2]={tf:'M1',ok:trigger&&entryOK,score:trigger&&entryOK?30:0,text:trigger&&entryOK?(result.opportunity==='REENTRY'?'REENTRY • استعادة فرصة بعد تصحيح صغير':'Trigger مؤكد بلا مطاردة'):(missed?'فات الدخول الأول • ننتظر Re-entry على M1':opp==='MOMENTUM'?'ننتظر micro-pullback ثم إعادة كسر على M1':'ننتظر Trigger M1')};
 if(!result.stages[2].ok)return stop(missed?'REENTRY':'M1',missed?'فات الدخول الأول؛ ننتظر تصحيحًا صغيرًا وإعادة كسر بدل إلغاء الفرصة.':'تأكيد M1 غير مكتمل.');
 result.score=result.stages.reduce((s,x)=>s+x.score,0);if(result.score<70)return stop('SCORE','جودة الإشارة أقل من الحد المطلوب.');
 const recent=m1.slice(-5),extreme=dir===1?Math.min(...recent.map(b=>b[3])):Math.max(...recent.map(b=>b[2])),sl=extreme-dir*.15*a1,risk=(p-sl)*dir;if(!positive(risk)||risk<.35*a1||risk>2.2*a1)return stop('RISK','مسافة الوقف غير مناسبة لسكالب سريع.');
 const trade={entry:p,sl,tp1:p+dir*risk*.75,tp2:p+dir*risk*1.25,tp3:p+dir*risk*1.8};if(!Object.values(trade).every(positive))return stop('RISK','تعذر حساب مستويات صالحة.');
 const stretch=Math.abs(p-e5)/a5,env=marketFeatures(m15,m5,m1,dir,p,e5,a5,a1);
 result.trade=trade;result.decision=dir===1?'BUY':'SELL';result.waitCode=null;
 result.meta={atr:a1,m15:m15.label,m5:m5t.label,m1:'CONFIRMED',m15Strength:m15.strength,m5Strength:m5t.strength,stretch,side:dir===1?'BUY':'SELL',setup:result.opportunity,aiFeatures:{m15Align:m15.direction===dir?1:m15.direction===0?0:-1,m15Strength:m15.strength,m5Strength:m5t.strength,stretch,score:result.score/100,isPullback:result.opportunity==='PULLBACK'?1:0,isContinuation:result.opportunity==='CONTINUATION'?1:0,isMomentum:result.opportunity==='MOMENTUM'?1:0,isReentry:result.opportunity==='REENTRY'?1:0,isBTC:input?.symbol==='BTCUSD'?1:0,vol1:env.vol1,vol5:env.vol5,body1:env.body1,body5:env.body5,compression5:env.compression5,distanceEma:env.distanceEma,trendAge5:env.trendAge5,entryDistance}};
 result.why='SCALP '+opp+' • M15 سياق، M5 تنفيذ، M1 Trigger • '+result.score+'/100.';return result;
}
return{TF,FRAMES,formatPrice,validBar,atr,ema,swings,trend,findPOI,continuation,momentum,marketFeatures,analyze};
});