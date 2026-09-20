'use strict';
(() => {
const A=window.MarketAnalysis,D=window.MarketData,J=window.SignalJournal,AI=window.AILearner,$=id=>document.getElementById(id);
const assets=['XAUUSD','BTCUSD'],analysisFrames=A.FRAMES,chartFrames=['M1','M3','M5','M15','H1','H4'],intervals={M1:'1m',M3:'3m',M5:'5m',M15:'15m',H1:'1h',H4:'4h'};
const store=Object.fromEntries(assets.map(s=>[s,{tick:null,bars:{},live:{},barTimes:{},errors:{},tickBusy:false,barBusy:false,lastBars:0,lastSignalKey:''}]));
function readSetting(k,fallback,allowed){try{const v=localStorage.getItem(k);return allowed.includes(v)?v:fallback;}catch{return fallback;}}
function save(k,v){try{localStorage.setItem(k,v);}catch{}}
let asset=readSetting('asset','XAUUSD',assets),tf=readSetting('tf','M1',chartFrames);
function chip(id,text,kind='muted'){const e=$(id);e.className='chip '+kind;e.textContent=text;}
function setAsset(s){if(!assets.includes(s))return;asset=s;save('asset',s);$('goldTab').classList.toggle('active',s==='XAUUSD');$('btcTab').classList.toggle('active',s==='BTCUSD');render();}
function setTF(value){if(!chartFrames.includes(value))return;tf=value;save('tf',tf);window.MarketChart.reset();for(const b of $('tfBtns').children)b.classList.toggle('active',b.dataset.tf===tf);render();}
window.setAsset=setAsset;window.go=(id,button)=>{$(id).scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===button));};
for(const name of chartFrames){const b=document.createElement('button');b.className='tf';b.textContent=name;b.dataset.tf=name;b.addEventListener('click',()=>setTF(name));$('tfBtns').appendChild(b);}
async function request(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch('https://biquote.io/api/'+path+(path.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
function freshTick(t,now){return t&&now-t.receivedAt<=5000&&t.receivedAt<=now+5000&&(t.sourceAt===null||(Number.isFinite(t.sourceAt)&&now-t.sourceAt<=10000&&t.sourceAt<=now+5000));}
function patch(s,now){const st=store[s],t=st.tick;if(!freshTick(t,now)||st.errors.tick||(t.marketState&&!['OPEN','TRADING','ACTIVE'].includes(t.marketState)))return;const stamp=t.sourceAt===null?now:t.sourceAt;for(const name of chartFrames)st.live[name]=D.patchLive(st.live[name]||st.bars[name]||[],t.price,stamp,name);}
async function refreshTick(s){const st=store[s];if(st.tickBusy)return;st.tickBusy=true;try{const value=D.normalizeTick(await request(s),Date.now());if(!value)throw Error('سعر غير صالح');st.tick=value;delete st.errors.tick;patch(s,Date.now());J.update(s,value.price,Date.now());AI.updateShadow(s,value.price,Date.now());AI.updateMissed(s,value.price,Date.now());AI.learn(AI.allTrainingRows(J.load()));}catch(e){st.errors.tick=e.name==='AbortError'?'انتهت مهلة الاتصال':e.message;}finally{st.tickBusy=false;if(asset===s)render();}}
async function refreshBars(s){const st=store[s];if(st.barBusy)return;st.barBusy=true;st.lastBars=Date.now();try{await Promise.all(chartFrames.map(async name=>{try{const values=D.normalizeBars(await request(s+'/ohlc?interval='+intervals[name]+'&limit=120'),name);if(values.length<(analysisFrames.includes(name)?55:20))throw Error('شموع غير كافية');st.bars[name]=values;st.barTimes[name]=Date.now();delete st.errors[name];const old=st.live[name]?.slice(-1)[0],current=values.at(-1),merged=values.map(b=>b.slice());if(old&&current&&old[0]===current[0]&&current[5]){const x=merged.at(-1);x[2]=Math.max(x[2],old[2]);x[3]=Math.min(x[3],old[3]);}st.live[name]=merged;patch(s,Date.now());}catch(e){st.errors[name]=e.name==='AbortError'?'انتهت مهلة الاتصال':e.message;}}));}finally{st.barBusy=false;if(asset===s)render();}}
function renderHistory(){
 const filter=x=>x.symbol===asset,st=J.stats(filter),rows=J.load().filter(filter).slice(-10).reverse();
 $('historyScope').textContent=asset+' • محفوظ محليًا';$('stTotal').textContent=st.total;$('stWin').textContent=st.winRate+'%';$('stR').textContent=st.avgR.toFixed(2);$('stTp1').textContent=st.tp1+'%';$('stTp2').textContent=st.tp2+'%';$('stTp3').textContent=st.tp3+'%';$('stSl').textContent=st.sl+'%';
 $('history').innerHTML=rows.length?rows.map(x=>'<div class="row"><strong>'+x.symbol+' '+x.side+'</strong> • '+x.type+' • '+x.score+'/100<br><span class="muted">سبب الدخول: '+((x.entryBasis||[]).join(' • ')||'—')+'</span><br>'+new Date(x.openedAt).toLocaleString('ar-SA')+' • '+x.status+'</div>').join(''):'<div class="row muted">لا توجد إشارات مسجلة لهذا الأصل بعد.</div>';
 const ms=AI.missedStats(asset),mr=AI.missedLoad().filter(x=>x.symbol===asset).slice(-10).reverse();
 $('missTotal').textContent=ms.total;$('missWin').textContent=ms.winRate+'%';$('missMove').textContent=ms.avgMove.toFixed(2)+'%';$('missWL').textContent=ms.wins+'/'+ms.losses;
 $('missedHistory').innerHTML=mr.length?mr.map(x=>'<div class="row"><strong>'+x.symbol+' '+x.side+'</strong> • '+x.type+'<br><span class="muted">'+x.reason+'</span><br>Entry '+A.formatPrice(x.entry)+' • '+x.status+' • Max +'+Number(x.maxFavorablePct||0).toFixed(2)+'%</div>').join(''):'<div class="row muted">لا توجد فرص AI ضائعة مسجلة بعد.</div>';
}
function nextStep(code){return({DATA:'انتظار بيانات مكتملة',STALE:'انتظار سعر حديث',CLOSED:'السوق مغلق',M5_TREND:'انتظار اتجاه M5 واضح',M15_CONFLICT:'M15 قوي بعكس M5',M5:'انتظار فرصة M5',M1:'انتظار Trigger على M1',REENTRY:'فات الدخول الأول؛ ننتظر Re-entry مضبوط',SCORE:'جودة الإشارة أقل من الحد',RISK:'إدارة المخاطر غير مناسبة',AI_REJECT:'AI رفض المرشح الحالي'})[code]||'مراقبة السوق';}
function maybeLog(symbol,an){
 if(!['BUY','SELL'].includes(an.decision))return;
 const st=store[symbol],key=[symbol,an.decision,an.opportunity,an.meta?.signalBar||0].join('|');
 if(st.lastSignalKey===key)return;
 J.add(symbol,an,Date.now());st.lastSignalKey=key;
 const title=(symbol==='XAUUSD'?'Gold':'Bitcoin')+' • '+an.decision+' • '+an.opportunity;
 const basis=(an.meta?.entryBasis||[]).join(' • ');
 const body='Entry '+A.formatPrice(an.trade.entry)+' | SL '+A.formatPrice(an.trade.sl)+' | TP1 '+A.formatPrice(an.trade.tp1)+' | TP2 '+A.formatPrice(an.trade.tp2)+' | TP3 '+A.formatPrice(an.trade.tp3)+(basis?'\n'+basis:'');
 if(window.AndroidNotify&&typeof window.AndroidNotify.signal==='function'){try{window.AndroidNotify.signal(title,body,key);}catch(e){}}
}
function applyAI(symbol,candidate){
 if(!candidate||!['BUY','SELL'].includes(candidate.decision))return{analysis:candidate,review:null};
 AI.learn(AI.allTrainingRows(J.load()));
 const review=AI.review(candidate);
 const enriched={...candidate,aiReview:review.mode,aiProbability:review.prob};
 if(!review.approve){
   AI.addShadow(symbol,candidate,review,Date.now());
   return{analysis:{...candidate,decision:'WAIT',waitCode:'AI_REJECT',why:'AI REVIEW: '+review.reason,trade:{entry:null,sl:null,tp1:null,tp2:null,tp3:null},aiReview:review.mode,aiProbability:review.prob},review};
 }
 return{analysis:enriched,review};
}
function render(){const st=store[asset],now=Date.now(),t=st.tick,live=freshTick(t,now)&&!st.errors.tick,ready=analysisFrames.every(n=>st.barTimes[n]&&now-st.barTimes[n]<90000&&!st.errors[n]);const raw=A.analyze({symbol:asset,bars:ready?st.live:{},tick:live?t:{},now});if(ready&&live)AI.scout(asset,st.live,t,raw.decision,now);const wrapped=applyAI(asset,raw),an=wrapped.analysis,review=wrapped.review;maybeLog(asset,an);
 $('symbol').textContent=asset;$('price').textContent=A.formatPrice(t?.price);const closed=t?.marketState&&!['OPEN','TRADING','ACTIVE'].includes(t.marketState);const sourceStale=t&&Number.isFinite(t.sourceAt)&&now-t.sourceAt>10000,offline=!!st.errors.tick;$('feed').textContent=closed?'MARKET CLOSED':offline?'OFFLINE':sourceStale?'SOURCE STALE':!live?'RECONNECTING':t?.sourceAt===null?'CONNECTED':'LIVE';$('dot').style.background=closed?'var(--warn)':offline||sourceStale?'var(--bad)':!live?'var(--warn)':'var(--good)';$('updated').textContent='آخر استلام: '+(t?new Date(t.receivedAt).toLocaleTimeString('ar-SA',{hour12:false}):'—');chip('bias','M15: '+an.bias,an.bias==='BULLISH'?'good':an.bias==='BEARISH'?'bad':'warn');chip('decisionChip',an.decision,an.decision==='BUY'?'good':an.decision==='SELL'?'bad':'warn');$('decision').textContent=an.decision;$('decision').style.color=an.decision==='BUY'?'var(--good)':an.decision==='SELL'?'var(--bad)':'var(--warn)';chip('marketState',t?.marketState||'حالة السوق غير متاحة',closed?'warn':'muted');$('score').textContent=an.score+'/100';$('score').style.setProperty('--score',Math.max(0,Math.min(100,an.score))+'%');$('opportunity').textContent=an.opportunity||'NO SETUP';$('nextStep').textContent='الخطوة التالية: '+(an.decision==='WAIT'?nextStep(an.waitCode):'إشارة مؤكدة');$('reason').textContent=an.why;$('entryBasis').textContent=(an.meta?.entryBasis||[]).join(' • ')||'—';$('waiting').textContent=an.decision==='WAIT'?an.why:'إشارة تحليلية + AI؛ تم تسجيلها محليًا مع سبب الدخول.';
 const aiInfo=AI.info(),prob=review?review.prob:(['BUY','SELL'].includes(raw.decision)?AI.probability(raw):null),mode=review?review.mode:(aiInfo.ready?'STANDBY':'LEARNING');
 chip('aiMode',mode,mode==='APPROVE'?'good':mode==='REJECT'?'bad':mode==='CAUTION'?'warn':'warn');
 $('aiProb').textContent=Number.isFinite(prob)?Math.round(prob*100)+'%':'—';
 $('aiReason').textContent=review?review.reason:(aiInfo.ready?'AI جاهز للمراجعة عند ظهور Candidate.':'AI يتعلم من نتائج الإشارات وShadow outcomes قبل التدخل.');
 $('aiSamples').textContent='Training samples: '+aiInfo.samples+' / '+AI.MIN_LEARN+(aiInfo.ready?' • ACTIVE':' • LEARNING');
 for(const k of ['entry','sl','tp1','tp2','tp3'])$(k).textContent=an.decision==='WAIT'?'—':A.formatPrice(an.trade[k]);for(const id of ['m15','m5','m1']){const e=$(id);if(e){e.textContent='—';e.style.color='#cbd5df';}}an.stages.forEach(s=>{const e=$(s.tf.toLowerCase());if(!e)return;e.textContent=(s.ok?'✓ ':'• ')+s.text+(s.score?' • '+s.score:'');e.style.color=s.ok?'#baf9d9':'#cbd5df';});const errors=Object.entries(st.errors);$('err').style.display=errors.length?'block':'none';$('err').textContent=errors.map(([k,v])=>(k==='tick'?'السعر':k)+': '+v).join(' • ');const candles=st.live[tf]||st.bars[tf]||[],count=window.MarketChart.draw($('chart'),candles,tf);$('chartLabel').textContent=tf+' • '+count+' شمعة';renderHistory();}
const chartEl=$('chart');
function showBar(b){if(!b)return;$('chartDetails').textContent=new Date(b[0]*1000).toLocaleString('ar-SA-u-ca-gregory')+' | O '+A.formatPrice(b[1])+' H '+A.formatPrice(b[2])+' L '+A.formatPrice(b[3])+' C '+A.formatPrice(b[4])+' V '+(b[6]??'—');}
chartEl.addEventListener('pointerdown',e=>{chartEl.setPointerCapture?.(e.pointerId);showBar(window.MarketChart.begin(e.clientX,e.clientY));});
chartEl.addEventListener('pointermove',e=>{if(e.buttons===1||e.pointerType==='touch')showBar(window.MarketChart.move(e.clientX,e.clientY));});
chartEl.addEventListener('pointerup',e=>{window.MarketChart.end(e.clientX,e.clientY);chartEl.releasePointerCapture?.(e.pointerId);});
chartEl.addEventListener('pointercancel',e=>window.MarketChart.end(e.clientX||0,e.clientY||0));
$('chartNow').addEventListener('click',()=>window.MarketChart.reset());
$('toolTrend').addEventListener('click',()=>{window.MarketChart.setTool('TREND');chip('toolState','Trend','good');});
$('toolRay').addEventListener('click',()=>{window.MarketChart.setTool('HLINE');chip('toolState','Horizontal','good');});
$('toolEma').addEventListener('click',()=>chip('toolEma',window.MarketChart.toggleEMA()?'EMA ON':'EMA','good'));
$('toolRsi').addEventListener('click',()=>chip('toolRsi',window.MarketChart.toggleRSI()?'RSI ON':'RSI','good'));
$('toolClear').addEventListener('click',()=>{window.MarketChart.clearDrawings();chip('toolState','Tools','muted');});
function download(name,text,type){
 if(window.AndroidExport&&typeof window.AndroidExport.saveTextFile==='function'){
   try{window.AndroidExport.saveTextFile(name,text,type);return;}catch(e){}
 }
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('exportCsv').addEventListener('click',()=>download('market-ai-signals.csv',J.csv(),'text/csv'));$('exportJson').addEventListener('click',()=>download('market-ai-signals.json',J.json(),'application/json'));
$('exportAiCsv').addEventListener('click',()=>download('market-ai-missed-opportunities-'+asset+'.csv',AI.missedCsv(asset),'text/csv'));
$('exportAiJson').addEventListener('click',()=>download('market-ai-missed-opportunities-'+asset+'.json',AI.missedJson(asset),'application/json'));
$('exportAiTraining').addEventListener('click',()=>download('market-ai-training-snapshot.json',AI.trainingExport(),'application/json'));
function poll(){const now=Date.now();for(const s of assets){patch(s,now);refreshTick(s);const st=store[s],m1=st.bars.M1||[],lastClosed=m1.filter(b=>!b[5]).at(-1),newBar=!lastClosed||lastClosed[0]<Math.floor(now/60000)*60-60;if(now-st.lastBars>=(newBar?5000:30000))refreshBars(s);}render();}
setAsset(asset);setTF(tf);poll();setInterval(poll,1000);addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();