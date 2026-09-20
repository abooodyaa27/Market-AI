/* Market AI SCALP V1 — M15 context, M5 setup, M1 trigger. No H1/H4 dependency. */
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
 let direction=0;if(f>s+.03*v&&delta>.08&&slope>.02)direction=1;if(f<s-.03*v&&delta<-.08&&slope<-.02)direction=-1;
 const strength=Math.min(1.5,Math.abs(f-s)/v+Math.abs(delta)*.35+Math.abs(slope)*.25);
 return{direction,strength,atr:v,fast:f,slow:s,label:direction===1?'اتجاه صاعد':direction===-1?'اتجاه هابط':'محايد'};
}
function findPOI(a,dir){
 const v=atr(a);if(!positive(v)||!dir)return null;const sw=swings(a),pivots=(dir===1?sw.ls:sw.hs).filter(p=>p.i>=a.length-26);
 for(let j=pivots.length-1;j>=0;j--){const p=pivots[j],b=p.bar;let low,high;if(dir===1){low=b[3]-.08*v;high=Math.min(Math.min(b[1],b[4])+.12*v,low+.9*v);}else{high=b[2]+.08*v;low=Math.max(Math.max(b[1],b[4])-.12*v,high-.9*v);}const after=a.slice(p.i+1),invalid=after.some(x=>dir===1?x[4]<low-.12*v:x[4]>high+.12*v),impulse=after.some(x=>dir===1?x[4]>high+.18*v:x[4]<low-.18*v);if(!invalid&&impulse&&low>0&&high>low)return{low,high,atr:v,time:b[0],direction:dir};}return null;
}
function continuation(a,dir){
 const v=atr(a);if(!positive(v)||a.length<25)return null;const e=ema(a,9).at(-1),last=a.at(-1),recent=a.slice(-6),range=Math.max(...recent.map(b=>b[2]))-Math.min(...recent.map(b=>b[3])),body=(last[4]-last[1])*dir,progress=(last[4]-recent[0][4])*dir;
 if(range<=2.8*v&&(last[4]-e)*dir>=-.2*v&&body>=.08*v&&progress>=.12*v)return{type:'CONTINUATION',atr:v,low:Math.min(...recent.map(b=>b[3])),high:Math.max(...recent.map(b=>b[2])),time:recent[0][0]};return null;
}
function analyze(input){
 const{bars={},tick={},now=Date.now()}=input||{},result={decision:'WAIT',bias:'MIXED',score:0,opportunity:null,waitCode:'DATA',why:'لا توجد صفقة حالياً.',poi:null,trade:{entry:null,sl:null,tp1:null,tp2:null,tp3:null},stages:FRAMES.map(tf=>({tf,ok:false,score:0,text:'بانتظار البيانات'})),meta:{}};
 const stop=(code,m)=>{result.waitCode=code;result.score=result.stages.reduce((s,x)=>s+(Number(x.score)||0),0);result.why='لا توجد صفقة حالياً. '+m;return result;};
 if(!positive(tick.price)||!Number.isFinite(tick.receivedAt)||now-tick.receivedAt>5000||tick.receivedAt>now+5000)return stop('DATA','الأسعار غير متاحة أو غير حديثة.');
 if(tick.sourceAt!==null&&tick.sourceAt!==undefined&&(!Number.isFinite(tick.sourceAt)||now-tick.sourceAt>10000||tick.sourceAt>now+5000))return stop('STALE','وقت سعر المصدر غير حديث.');
 if(tick.marketState&&!['OPEN','TRADING','ACTIVE'].includes(String(tick.marketState).toUpperCase()))return stop('CLOSED','السوق مغلق أو حالته غير مؤكدة.');
 const closed={};for(const tf of FRAMES){const a=bars[tf];if(!Array.isArray(a)||a.length<55||a.some((b,i)=>!validBar(b)||(i>0&&b[0]<=a[i-1][0])))return stop('DATA','بيانات '+tf+' ناقصة أو غير صالحة.');closed[tf]=a.filter(b=>b[5]!==true&&(b[0]+TF[tf])*1000<=now);const c=closed[tf];if(c.length<55)return stop('DATA','ننتظر شموعاً مغلقة كافية على '+tf+'.');const bucket=Math.floor(now/1000/TF[tf])*TF[tf];if(c.at(-1)[0]!==bucket-TF[tf])return stop('DATA','ننتظر آخر شمعة مغلقة على '+tf+'.');const span=tf==='M1'?6:tf==='M5'?5:3,tail=c.slice(-span);if(tail.some((b,i)=>i>0&&b[0]-tail[i-1][0]!==TF[tf]))return stop('DATA','توجد فجوة في بيانات '+tf+'.');}
 const m15=trend(closed.M15),dir=m15.direction;if(!dir)return stop('M15_TREND','اتجاه M15 غير واضح.');
 result.bias=dir===1?'BULLISH':'BEARISH';result.stages[0]={tf:'M15',ok:true,score:40,text:m15.label+' • سياق السكالب'};
 let opp=null,zone=findPOI(closed.M15,dir),p=tick.price;if(zone){const near=p>=zone.low-.3*zone.atr&&p<=zone.high+.3*zone.atr;if(near){opp='PULLBACK';result.poi=zone;}}
 if(!opp){const cont=continuation(closed.M15,dir);if(cont&&Math.abs(p-ema(closed.M15,9).at(-1))<=1.15*cont.atr){opp='CONTINUATION';result.poi=cont;}}
 result.opportunity=opp;if(!opp)return stop('M15','ننتظر Pullback أو Continuation مناسبة على M15.');
 const m5=closed.M5,b5=m5.at(-1),a5=atr(m5),e5=ema(m5,9).at(-1),body5=(b5[4]-b5[1])*dir,progress5=(b5[4]-m5.at(-2)[4])*dir;
 let setup=false;if(opp==='PULLBACK'){const z=result.poi,touch=m5.slice(-5).some(b=>b[3]<=z.high+.25*z.atr&&b[2]>=z.low-.25*z.atr);setup=touch&&body5>=.08*a5&&(b5[4]-e5)*dir>-.05*a5&&progress5>0&&(b5[2]-b5[3])<=2.2*a5;}else setup=body5>=.08*a5&&(b5[4]-e5)*dir>0&&progress5>.02*a5&&(b5[2]-b5[3])<=2*a5;
 result.stages[1]={tf:'M5',ok:setup,score:setup?30:0,text:setup?'Setup مؤكد':'ننتظر Setup M5'};if(!setup)return stop('M5','تأكيد M5 غير مكتمل.');
 const m1=closed.M1,last=m1.at(-1),previous=m1.slice(-5,-1),a1=atr(m1),level=dir===1?Math.max(...previous.map(b=>b[2])):Math.min(...previous.map(b=>b[3])),trigger=(last[4]-level)*dir>.03*a1&&(last[4]-last[1])*dir>=.1*a1&&(last[2]-last[3])<=2*a1,entryOK=(p-level)*dir>0&&Math.abs(p-last[4])<=.4*a1;
 result.stages[2]={tf:'M1',ok:trigger&&entryOK,score:trigger&&entryOK?30:0,text:trigger&&entryOK?'Trigger مؤكد بلا مطاردة':'ننتظر Trigger M1'};if(!result.stages[2].ok)return stop('M1','تأكيد M1 غير مكتمل أو السعر ابتعد عن الدخول.');
 result.score=100;const recent=m1.slice(-5),extreme=dir===1?Math.min(...recent.map(b=>b[3])):Math.max(...recent.map(b=>b[2])),sl=extreme-dir*.15*a1,risk=(p-sl)*dir;if(!positive(risk)||risk<.35*a1||risk>2.2*a1)return stop('RISK','مسافة الوقف غير مناسبة لسكالب سريع.');
 const trade={entry:p,sl,tp1:p+dir*risk*.75,tp2:p+dir*risk*1.25,tp3:p+dir*risk*1.8};if(!Object.values(trade).every(positive))return stop('RISK','تعذر حساب مستويات صالحة.');
 result.trade=trade;result.decision=dir===1?'BUY':'SELL';result.waitCode=null;result.meta={atr:a1,m15:m15.label,m5:'CONFIRMED',m1:'CONFIRMED'};result.why='SCALP '+opp+' • M15 اتجاه، M5 Setup، M1 Trigger • '+result.score+'/100.';return result;
}
return{TF,FRAMES,formatPrice,validBar,atr,ema,swings,trend,findPOI,continuation,analyze};
});