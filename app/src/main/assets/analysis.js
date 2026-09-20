/* Deterministic analysis: closed candles only; no orders, network or shared state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketAnalysis=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const TF={H4:14400,H1:3600,M15:900,M5:300,M1:60};
const FRAMES=Object.keys(TF);
const VERSION='2.1.0',WEIGHTS={H4:15,H1:25,M15:20,M5:20,M1:20};
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function formatPrice(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return '—';const n=Number(v);return positive(n)?n.toFixed(n>=10000?2:3):'—';}
function validBar(b){return Array.isArray(b)&&b.length>=5&&positive(b[0])&&b.slice(1,5).every(positive)&&b[2]>=Math.max(b[1],b[3],b[4])&&b[3]<=Math.min(b[1],b[4]);}
function atr(a,n=14){if(a.length<n+1)return null;let sum=0;for(let i=a.length-n;i<a.length;i++)sum+=Math.max(a[i][2]-a[i][3],Math.abs(a[i][2]-a[i-1][4]),Math.abs(a[i][3]-a[i-1][4]));return sum/n;}
function ema(a,n){if(a.length<n)return [];let v=a.slice(0,n).reduce((s,b)=>s+b[4],0)/n;const result=[v],k=2/(n+1);for(let i=n;i<a.length;i++){v+=k*(a[i][4]-v);result.push(v);}return result;}
function swings(a){const hs=[],ls=[];for(let i=2;i<a.length-2;i++){const b=a[i],near=a.slice(i-2,i+3); // Unique extrema: flat plateaus aren't multiple swings.
 if(near.every((v,j)=>j===2||b[2]>=v[2])&&b[2]>a[i-1][2]&&b[2]>a[i+1][2])hs.push({i,price:b[2],bar:b});
 if(near.every((v,j)=>j===2||b[3]<=v[3])&&b[3]<a[i-1][3]&&b[3]<a[i+1][3])ls.push({i,price:b[3],bar:b});
}return {hs,ls};}
function trend(a){
 const v=atr(a),fast=ema(a,20),slow=ema(a,50);if(!positive(v)||fast.length<4||!slow.length)return {direction:0,structural:0,label:'بيانات غير كافية'};
 const f=fast[fast.length-1],s=slow[slow.length-1],slope=(f-fast[fast.length-4])/v,p=a[a.length-1][4],tol=.12*v;
 const sw=swings(a),h=sw.hs.slice(-2),l=sw.ls.slice(-2);let structural=0;
 if(h.length===2&&l.length===2){const dh=h[1].price-h[0].price,dl=l[1].price-l[0].price;
 if(dh>=-tol&&dl>=-tol&&(dh>tol||dl>tol))structural=1;
 if(dh<=tol&&dl<=tol&&(dh<-tol||dl<-tol))structural=-1;}
 const lastH=h[h.length-1],lastL=l[l.length-1];
 const breakUp=!!lastH&&p>lastH.price+tol,breakDown=!!lastL&&p<lastL.price-tol;
 let direction=0;
 if(f>s+.08*v&&slope>.08&&p>=f-.35*v&&structural!==-1&&!breakDown)direction=1;
 if(f<s-.08*v&&slope<-.08&&p<=f+.35*v&&structural!==1&&!breakUp)direction=-1;
 return {direction,structural,breakUp,breakDown,atr:v,fast:f,slow:s,slope,label:direction===1?'اتجاه صاعد':direction===-1?'اتجاه هابط':'محايد / تعارض مؤكد'};
}
// Lifecycle context must not depend on unrelated frame/network readiness.
function confirmedH1(bars,now,fetchedAt){
 const none={direction:0,time:null};
 if(!Number.isFinite(fetchedAt)||now-fetchedAt>=90000||fetchedAt>now+5000||!Array.isArray(bars)||bars.some((b,i)=>!validBar(b)||(i>0&&b[0]<=bars[i-1][0])))return none;
 const closed=bars.filter(b=>b[5]!==true&&(b[0]+3600)*1000<=now),last=closed[closed.length-1];
 if(closed.length<55||last[0]!==Math.floor(now/3600000)*3600-3600)return none;
 const t=trend(closed),d=t.direction,ok=d&&(t.structural===d||(d===1?t.breakUp:t.breakDown));
 return {direction:ok?d:0,time:last[0]+3600};
}
function findPOI(a,dir){
 const v=atr(a);if(!positive(v)||!dir)return null;
 const sw=swings(a),pivots=(dir===1?sw.ls:sw.hs).filter(p=>p.i>=a.length-30);
 for(let j=pivots.length-1;j>=0;j--){const p=pivots[j],b=p.bar;let low,high;
 if(dir===1){low=b[3]-.1*v;high=Math.min(Math.min(b[1],b[4])+.1*v,low+v);}
 else{high=b[2]+.1*v;low=Math.max(Math.max(b[1],b[4])-.1*v,high-v);}
 const following=a.slice(p.i+1);const invalid=following.some(x=>dir===1?x[4]<low-.1*v:x[4]>high+.1*v);
 const impulse=following.some(x=>dir===1?x[4]>high+.2*v:x[4]<low-.2*v);
 if(!invalid&&impulse&&low>0&&high>low)return {low,high,atr:v,time:b[0],direction:dir};
 }return null;
}
function continuationZone(a,dir,p){
 const v=atr(a),fast=ema(a,20),slow=ema(a,50);if(!positive(v)||fast.length<4||!slow.length)return null;
 const f=fast[fast.length-1],sl=slow[slow.length-1],recent=a.slice(-4);
 const low=Math.min(...recent.map(b=>b[3])),high=Math.max(...recent.map(b=>b[2]));
 const consolidation=high-low<=2*v&&Math.abs(recent[3][4]-recent[0][1])<=v;
 const correction=recent.some(b=>(b[4]-b[1])*dir<=0);
 const trendOK=(f-sl)*dir>.08*v&&(f-fast[fast.length-4])*dir>=0;
 const near=p>=low-.25*v&&p<=high+.25*v&&Math.abs(p-f)<=2*v;
 if(!consolidation||!correction||!trendOK||!near)return null;
 return {low,high,atr:v,time:recent[0][0],direction:dir};
}
function strongMacro(t){return !!t.direction&&Number.isFinite(t.atr)&&Math.abs(t.slope)>=.15&&Math.abs(t.fast-t.slow)>=.3*t.atr&&(t.structural===t.direction||(t.direction===1?t.breakUp:t.breakDown));}
function analyze(input){
 const {bars={},tick={},now=Date.now()}=input||{};
 const result={version:VERSION,score:0,opportunityType:null,macroBias:'MIXED',macroConflict:false,executiveDirection:0,atr:null,triggerTime:null,decision:'WAIT',bias:'MIXED',why:'لا توجد صفقة حالياً.',poi:null,trade:{entry:null,sl:null,tp1:null,tp2:null,tp3:null},stages:FRAMES.map(tf=>({tf,ok:false,text:'بانتظار البيانات'}))};
 const score=()=>{result.score=result.stages.reduce((n,s)=>n+(s.ok?WEIGHTS[s.tf]:0),0);};
 const stop=message=>{score();result.why='لا توجد صفقة حالياً. '+message;return result;};
 if(!positive(tick.price)||!Number.isFinite(tick.receivedAt)||now-tick.receivedAt>5000||tick.receivedAt>now+5000)return stop('الأسعار غير متاحة أو غير حديثة.');
 if(tick.sourceAt!==null&&tick.sourceAt!==undefined&&(!Number.isFinite(tick.sourceAt)||now-tick.sourceAt>10000||tick.sourceAt>now+5000))return stop('وقت سعر المصدر غير حديث.');
 if(tick.marketState&& !['OPEN','TRADING','ACTIVE'].includes(String(tick.marketState).toUpperCase()))return stop('السوق مغلق أو حالته غير مؤكدة.');
 const closed={};
 for(const tf of FRAMES){const a=bars[tf];if(!Array.isArray(a)||a.length<55||a.some((b,i)=>!validBar(b)||(i>0&&b[0]<=a[i-1][0])))return stop('بيانات '+tf+' ناقصة أو غير صالحة.');
 closed[tf]=a.filter(b=>b[5]!==true&&(b[0]+TF[tf])*1000<=now);
 const c=closed[tf];if(c.length<55)return stop('ننتظر شموعاً مغلقة كافية على '+tf+'.');
 const bucket=Math.floor(now/1000/TF[tf])*TF[tf];
 if(c[c.length-1][0]!==bucket-TF[tf])return stop('ننتظر تأكيد آخر شمعة مغلقة على '+tf+'.');
 // Do not treat historical exchange closures as corruption. Require continuity only
 // across the actual M1 breakout / M5 setup window. ATR includes opening gaps.
 const span=tf==='M1'?6:tf==='M5'?5:1,tail=c.slice(-span);if(tail.some((b,i)=>i>0&&b[0]-tail[i-1][0]!==TF[tf]))return stop('توجد فجوة في بيانات '+tf+'.');
 }
 const h4=trend(closed.H4),h1=trend(closed.H1),dir=h1.direction;
 result.executiveDirection=dir;
 result.bias=dir===1?'BULLISH':dir===-1?'BEARISH':'MIXED';
 result.macroBias=h4.direction===1?'BULLISH':h4.direction===-1?'BEARISH':'MIXED';
 result.macroConflict=!!dir&&h4.direction===-dir&&strongMacro(h4);
 result.stages[0]={tf:'H4',ok:!!dir&&h4.direction===dir,text:h4.label+(result.macroConflict?' • تعارض قوي':!h4.direction?' • سياق محايد يسمح بالفرص':' • سياق عام')};
 const structureOK=!!dir&&(h1.structural===dir||(dir===1?h1.breakUp:h1.breakDown));
 result.stages[1]={tf:'H1',ok:structureOK,text:structureOK?h1.label+' • اتجاه تنفيذي وبنية مؤكدة':h1.label+' • ننتظر تأكيد البنية'};
 if(!structureOK)return stop('بنية H1 واتجاهه غير واضحين.');
 if(result.macroConflict)return stop('تعارض قوي من H4 مع اتجاه H1.');
 const p=tick.price,poi=findPOI(closed.M15,dir);
 const near=poi&&p>=poi.low-(dir===1?.2:.35)*poi.atr&&p<=poi.high+(dir===1?.35:.2)*poi.atr;
 const continuation=near?null:continuationZone(closed.M15,dir,p),zone=near?poi:continuation;
 result.poi=near?poi:null;
 result.opportunityType=near?'PULLBACK':continuation?'CONTINUATION':null;
 result.stages[2]={tf:'M15',ok:!!zone,text:zone?result.opportunityType+' • '+formatPrice(zone.low)+' → '+formatPrice(zone.high):'لا يوجد تصحيح / تجميع صالح قريب من السعر'};
 if(!zone)return stop('لا يوجد مسار PULLBACK أو CONTINUATION صالح؛ لا نطارد الحركة.');
 const m5=closed.M5,m1=closed.M1,b5=m5[m5.length-1],a5=atr(m5),e5=ema(m5,20).slice(-1)[0];
 const touch=m5.slice(-5).some(b=>b[0]>=zone.time&&b[3]<=zone.high+.2*zone.atr&&b[2]>=zone.low-.2*zone.atr);
 const body5=(b5[4]-b5[1])*dir,setup=touch&&body5>=.1*a5&&(b5[4]-e5)*dir>0&&(b5[4]-m5[m5.length-2][4])*dir>0&&(b5[2]-b5[3])<=2*a5;
 result.stages[3]={tf:'M5',ok:setup,text:setup?'ارتداد مغلق مؤكد من المنطقة':'ننتظر ارتداداً مغلقاً مع الاتجاه'};
 if(!setup)return stop('تأكيد M5 غير مكتمل.');
 const last=m1[m1.length-1],previous=m1.slice(-6,-1),a1=atr(m1);
 const level=dir===1?Math.max(...previous.map(b=>b[2])):Math.min(...previous.map(b=>b[3]));
 result.triggerTime=last[0];result.atr=a1;
 const trigger=(last[4]-level)*dir>.05*a1&&(last[4]-last[1])*dir>=.15*a1&&last[2]-last[3]<=1.8*a1;
 // Trigger expires at the next closed M1 bar; reject prices that reversed or ran away.
 const entryOK=(p-level)*dir>0&&Math.abs(p-last[4])<=.5*a1;
 result.stages[4]={tf:'M1',ok:trigger&&entryOK,text:trigger&&entryOK?'كسر سوينغ مصغّر بشمعة مغلقة':'ننتظر كسراً مغلقاً بلا مطاردة'};
 score();
 if(result.score<70||!result.stages[3].ok||!result.stages[4].ok)return stop('تأكيد M1 غير مكتمل أو تجاوز السعر منطقة الدخول.');
 const recent=m1.slice(-5),extreme=dir===1?Math.min(...recent.map(b=>b[3])):Math.max(...recent.map(b=>b[2]));
 const sl=extreme-dir*.2*a1,risk=(p-sl)*dir;
 if(!positive(risk)||risk<.5*a1||risk>3*a1)return stop('مسافة الوقف غير مناسبة للتذبذب الحالي.');
 const trade={entry:p,sl,tp1:p+dir*risk,tp2:p+dir*risk*1.75,tp3:p+dir*risk*2.5};
 if(!Object.values(trade).every(positive))return stop('تعذر حساب مستويات صالحة.');
 result.trade=trade;result.decision=dir===1?'BUY':'SELL';result.why=result.opportunityType+' • H1 تنفيذي مع M15/M5/M1 مؤكدة. الدرجة '+result.score+'/100؛ مستويات الإشارة تثبت عند التسجيل.';
 return result;
}
return {VERSION,WEIGHTS,TF,FRAMES,confirmedH1,strongMacro,continuationZone,formatPrice,validBar,atr,ema,swings,trend,findPOI,analyze};
});
