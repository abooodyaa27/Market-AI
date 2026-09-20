/* Market AI V2.1 deterministic multi-timeframe analysis. Closed candles only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketAnalysis=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const TF={H4:14400,H1:3600,M15:900,M5:300,M1:60},FRAMES=Object.keys(TF);
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function formatPrice(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return '—';const n=Number(v);return positive(n)?n.toFixed(n>=10000?2:3):'—';}
function validBar(b){return Array.isArray(b)&&b.length>=5&&positive(b[0])&&b.slice(1,5).every(positive)&&b[2]>=Math.max(b[1],b[3],b[4])&&b[3]<=Math.min(b[1],b[4]);}
function atr(a,n=14){if(a.length<n+1)return null;let sum=0;for(let i=a.length-n;i<a.length;i++)sum+=Math.max(a[i][2]-a[i][3],Math.abs(a[i][2]-a[i-1][4]),Math.abs(a[i][3]-a[i-1][4]));return sum/n;}
function ema(a,n){if(a.length<n)return [];let v=a.slice(0,n).reduce((s,b)=>s+b[4],0)/n;const out=[v],k=2/(n+1);for(let i=n;i<a.length;i++){v+=k*(a[i][4]-v);out.push(v);}return out;}
function swings(a){const hs=[],ls=[];for(let i=2;i<a.length-2;i++){const b=a[i],near=a.slice(i-2,i+3);if(near.every((v,j)=>j===2||b[2]>=v[2])&&b[2]>a[i-1][2]&&b[2]>a[i+1][2])hs.push({i,price:b[2],bar:b});if(near.every((v,j)=>j===2||b[3]<=v[3])&&b[3]<a[i-1][3]&&b[3]<a[i+1][3])ls.push({i,price:b[3],bar:b});}return{hs,ls};}
function trend(a){
 const v=atr(a),fast=ema(a,20),slow=ema(a,50);if(!positive(v)||fast.length<4||!slow.length)return{direction:0,strength:0,structural:0,label:'بيانات غير كافية'};
 const f=fast.at(-1),s=slow.at(-1),slope=(f-fast.at(-4))/v,p=a.at(-1)[4],tol=.12*v,sw=swings(a),h=sw.hs.slice(-2),l=sw.ls.slice(-2);let structural=0;
 if(h.length===2&&l.length===2){const dh=h[1].price-h[0].price,dl=l[1].price-l[0].price;if(dh>=-tol&&dl>=-tol&&(dh>tol||dl>tol))structural=1;if(dh<=tol&&dl<=tol&&(dh<-tol||dl<-tol))structural=-1;}
 const lastH=h.at(-1),lastL=l.at(-1),breakUp=!!lastH&&p>lastH.price+tol,breakDown=!!lastL&&p<lastL.price-tol;
 let direction=0;if(f>s+.08*v&&slope>.08&&p>=f-.35*v&&structural!==-1&&!breakDown)direction=1;if(f<s-.08*v&&slope<-.08&&p<=f+.35*v&&structural!==1&&!breakUp)direction=-1;
 const strength=Math.min(1.5,Math.abs(f-s)/v+Math.abs(slope)*.35+(structural===direction?.35:0)+(direction===1&&breakUp||direction===-1&&breakDown?.25:0));
 return{direction,strength,structural,breakUp,breakDown,atr:v,fast:f,slow:s,slope,label:direction===1?'اتجاه صاعد':direction===-1?'اتجاه هابط':'محايد'};
}
function findPOI(a,dir){
 const v=atr(a);if(!positive(v)||!dir)return null;const sw=swings(a),pivots=(dir===1?sw.ls:sw.hs).filter(p=>p.i>=a.length-30);
 for(let j=pivots.length-1;j>=0;j--){const p=pivots[j],b=p.bar;let low,high;if(dir===1){low=b[3]-.1*v;high=Math.min(Math.min(b[1],b[4])+.1*v,low+v);}else{high=b[2]+.1*v;low=Math.max(Math.max(b[1],b[4])-.1*v,high-v);}const following=a.slice(p.i+1),invalid=following.some(x=>dir===1?x[4]<low-.1*v:x[4]>high+.1*v),impulse=following.some(x=>dir===1?x[4]>high+.2*v:x[4]<low-.2*v);if(!invalid&&impulse&&low>0&&high>low)return{low,high,atr:v,time:b[0],direction:dir};}return null;
}
function continuation(a,dir){
 const v=atr(a);if(!positive(v)||a.length<25)return null;const e=ema(a,20).at(-1),last=a.at(-1),recent=a.slice(-6),range=Math.max(...recent.map(b=>b[2]))-Math.min(...recent.map(b=>b[3])),body=(last[4]-last[1])*dir,progress=(last[4]-recent[0][4])*dir;
 const compressed=range<=2.6*v,holds=(last[4]-e)*dir>=-.15*v,impulse=body>=.12*v&&progress>=.18*v;
 if(compressed&&holds&&impulse)return{type:'CONTINUATION',atr:v,low:Math.min(...recent.map(b=>b[3])),high:Math.max(...recent.map(b=>b[2])),time:recent[0][0]};return null;
}
function analyze(input){
 const{bars={},tick={},now=Date.now()}=input||{};const result={decision:'WAIT',bias:'MIXED',score:0,opportunity:null,why:'لا توجد صفقة حالياً.',poi:null,trade:{entry:null,sl:null,tp1:null,tp2:null,tp3:null},stages:FRAMES.map(tf=>({tf,ok:false,score:0,text:'بانتظار البيانات'})),meta:{}};
 const stop=m=>{result.why='لا توجد صفقة حالياً. '+m;return result;};
 if(!positive(tick.price)||!Number.isFinite(tick.receivedAt)||now-tick.receivedAt>5000||tick.receivedAt>now+5000)return stop('الأسعار غير متاحة أو غير حديثة.');
 if(tick.sourceAt!==null&&tick.sourceAt!==undefined&&(!Number.isFinite(tick.sourceAt)||now-tick.sourceAt>10000||tick.sourceAt>now+5000))return stop('وقت سعر المصدر غير حديث.');
 if(tick.marketState&&!['OPEN','TRADING','ACTIVE'].includes(String(tick.marketState).toUpperCase()))return stop('السوق مغلق أو حالته غير مؤكدة.');
 const closed={};for(const tf of FRAMES){const a=bars[tf];if(!Array.isArray(a)||a.length<55||a.some((b,i)=>!validBar(b)||(i>0&&b[0]<=a[i-1][0])))return stop('بيانات '+tf+' ناقصة أو غير صالحة.');closed[tf]=a.filter(b=>b[5]!==true&&(b[0]+TF[tf])*1000<=now);const c=closed[tf];if(c.length<55)return stop('ننتظر شموعاً مغلقة كافية على '+tf+'.');const bucket=Math.floor(now/1000/TF[tf])*TF[tf];if(c.at(-1)[0]!==bucket-TF[tf])return stop('ننتظر تأكيد آخر شمعة مغلقة على '+tf+'.');const span=tf==='M1'?6:tf==='M5'?5:1,tail=c.slice(-span);if(tail.some((b,i)=>i>0&&b[0]-tail[i-1][0]!==TF[tf]))return stop('توجد فجوة في بيانات '+tf+'.');}
 const h4=trend(closed.H4),h1=trend(closed.H1);let dir=h1.direction;if(!dir)return stop('اتجاه H1 التنفيذي غير واضح.');
 result.bias=h4.direction===1?'BULLISH':h4.direction===-1?'BEARISH':'MIXED';
 const h4Opp=h4.direction===-dir&&h4.strength>=.65;if(h4Opp)return stop('H4 قوي بعكس اتجاه H1.');
 const h4Score=h4.direction===dir?15:h4.direction===0?8:0;result.stages[0]={tf:'H4',ok:!h4Opp,score:h4Score,text:h4.direction===0?'محايد • لا يمنع الصفقة':h4.label};
 const h1Confirmed=h1.direction===dir&&(h1.structural===dir||(dir===1?h1.breakUp:h1.breakDown));if(!h1Confirmed)return stop('اتجاه H1 موجود لكن البنية لم تتأكد بعد.');const h1Score=25;result.stages[1]={tf:'H1',ok:true,score:h1Score,text:h1.label+' • بنية مؤكدة'};
 let m15Score=0,opp=null,zone=findPOI(closed.M15,dir),cont=null,p=tick.price;
 if(zone){const near=p>=zone.low-(dir===1?.2:.35)*zone.atr&&p<=zone.high+(dir===1?.35:.2)*zone.atr;if(near){opp='PULLBACK';m15Score=20;result.poi=zone;}}
 if(!opp){cont=continuation(closed.M15,dir);if(cont){const ext=atr(closed.M15);const ema20=ema(closed.M15,20).at(-1),notChasing=Math.abs(p-ema20)<=1.25*ext;if(notChasing){opp='CONTINUATION';m15Score=16;result.poi=cont;}}}
 result.opportunity=opp;result.stages[2]={tf:'M15',ok:!!opp,score:m15Score,text:opp==='PULLBACK'?'PULLBACK • عودة إلى POI':opp==='CONTINUATION'?'CONTINUATION • استمرار بعد تصحيح':'لا توجد فرصة M15 صالحة'};if(!opp)return stop('لا توجد Pullback أو Continuation صالحة على M15.');
 const m5=closed.M5,m1=closed.M1,b5=m5.at(-1),a5=atr(m5),e5=ema(m5,20).at(-1),body5=(b5[4]-b5[1])*dir;
 let setup=false;if(opp==='PULLBACK'){const z=result.poi,touch=m5.slice(-5).some(b=>b[0]>=z.time&&b[3]<=z.high+.2*z.atr&&b[2]>=z.low-.2*z.atr);setup=touch&&body5>=.1*a5&&(b5[4]-e5)*dir>0&&(b5[4]-m5.at(-2)[4])*dir>0&&(b5[2]-b5[3])<=2*a5;}else{setup=body5>=.12*a5&&(b5[4]-e5)*dir>0&&(b5[4]-m5.at(-2)[4])*dir>.03*a5&&(b5[2]-b5[3])<=1.8*a5;}
 result.stages[3]={tf:'M5',ok:setup,score:setup?20:0,text:setup?'Setup مغلق مؤكد':'ننتظر Setup M5'};if(!setup)return stop('تأكيد M5 غير مكتمل.');
 const last=m1.at(-1),previous=m1.slice(-6,-1),a1=atr(m1),level=dir===1?Math.max(...previous.map(b=>b[2])):Math.min(...previous.map(b=>b[3])),trigger=(last[4]-level)*dir>.05*a1&&(last[4]-last[1])*dir>=.15*a1&&(last[2]-last[3])<=1.8*a1,entryOK=(p-level)*dir>0&&Math.abs(p-last[4])<=.5*a1;
 result.stages[4]={tf:'M1',ok:trigger&&entryOK,score:trigger&&entryOK?20:0,text:trigger&&entryOK?'Trigger مغلق بلا مطاردة':'ننتظر Trigger M1'};if(!result.stages[4].ok)return stop('تأكيد M1 غير مكتمل أو تجاوز السعر منطقة الدخول.');
 result.score=result.stages.reduce((s,x)=>s+x.score,0);if(result.score<70)return stop('Signal Score أقل من 70.');
 const recent=m1.slice(-5),extreme=dir===1?Math.min(...recent.map(b=>b[3])):Math.max(...recent.map(b=>b[2])),sl=extreme-dir*.2*a1,risk=(p-sl)*dir;if(!positive(risk)||risk<.5*a1||risk>3*a1)return stop('مسافة الوقف غير مناسبة للتذبذب الحالي.');
 const trade={entry:p,sl,tp1:p+dir*risk,tp2:p+dir*risk*1.75,tp3:p+dir*risk*2.5};if(!Object.values(trade).every(positive))return stop('تعذر حساب مستويات صالحة.');
 result.trade=trade;result.decision=dir===1?'BUY':'SELL';result.meta={atr:a1,h4:h4.label,h1:h1.label,m15:opp,m5:'CONFIRMED',m1:'CONFIRMED'};result.why='إشارة '+opp+' بدرجة '+result.score+'/100. H1 تنفيذي وM5/M1 مؤكدان.';return result;
}
return{TF,FRAMES,formatPrice,validBar,atr,ema,swings,trend,findPOI,continuation,analyze};
});