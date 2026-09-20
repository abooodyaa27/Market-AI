'use strict';
(() => {
const A=window.MarketAnalysis,D=window.MarketData,J=window.SignalJournal,$=id=>document.getElementById(id);
let deviceStorage;try{deviceStorage=window.localStorage;}catch{deviceStorage={getItem:()=>{throw Error('unavailable');},setItem:()=>{throw Error('unavailable');}};}
const journal=new J.Journal(deviceStorage);window.flushSignalHistory=()=>journal.flush();
window.onSignalExportResult=message=>{$('exportStatus').textContent=message;};
let historyShown=false,lastHistoryRevision=-1;
const assets=['XAUUSD','BTCUSD'],frames=A.FRAMES,intervals={H4:'4h',H1:'1h',M15:'15m',M5:'5m',M1:'1m'};
const store=Object.fromEntries(assets.map(s=>[s,{tick:null,bars:{},live:{},barTimes:{},errors:{},tickBusy:false,barBusy:false,lastBars:0}]));
function readSetting(k,fallback,allowed){try{const v=localStorage.getItem(k);return allowed.includes(v)?v:fallback;}catch{return fallback;}}
function save(k,v){try{localStorage.setItem(k,v);}catch{/* WebView storage unavailable: keep in-memory selection. */}}
let asset=readSetting('asset','XAUUSD',assets),tf=readSetting('tf','M1',frames);
function chip(id,text,kind='muted'){const e=$(id);e.className='chip '+kind;e.textContent=text;}
function setAsset(s){if(!assets.includes(s))return;asset=s;save('asset',s);$('goldTab').classList.toggle('active',s==='XAUUSD');$('btcTab').classList.toggle('active',s==='BTCUSD');$('chartDetails').textContent='المس الشارت لعرض تفاصيل الشمعة';render();}
function setTF(value){if(!frames.includes(value))return;tf=value;save('tf',tf);for(const b of $('tfBtns').children)b.classList.toggle('active',b.dataset.tf===tf);$('chartDetails').textContent='المس الشارت لعرض تفاصيل الشمعة';render();}
window.setAsset=setAsset;
window.go=(id,button)=>{historyShown=id==='historyPage';$('historyPage').hidden=!historyShown;$('marketPage').hidden=historyShown;if(historyShown){window.HistoryUI.render(journal);lastHistoryRevision=journal.revision;}$(id).scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===button));};
for(const name of frames){const b=document.createElement('button');b.className='tf';b.textContent=name;b.dataset.tf=name;b.addEventListener('click',()=>setTF(name));$('tfBtns').appendChild(b);}
async function request(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch('https://biquote.io/api/'+path+(path.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
function freshTick(t,now){return t&&now-t.receivedAt<=5000&&t.receivedAt<=now+5000&&(t.sourceAt===null||(Number.isFinite(t.sourceAt)&&now-t.sourceAt<=10000&&t.sourceAt<=now+5000));}
function patch(s,now){const st=store[s],t=st.tick;if(!freshTick(t,now)||st.errors.tick||(t.marketState&&!['OPEN','TRADING','ACTIVE'].includes(t.marketState)))return;const stamp=t.sourceAt===null?now:t.sourceAt;for(const name of frames)st.live[name]=D.patchLive(st.live[name]||st.bars[name]||[],t.price,stamp,name);}
function processSignal(s,now){
 const st=store[s],live=freshTick(st.tick,now)&&!st.errors.tick;
 const ready=frames.every(n=>st.barTimes[n]&&now-st.barTimes[n]<90000&&!st.errors[n]);
 const candidate=A.analyze({symbol:s,bars:ready?st.bars:{},tick:live?st.tick:{},now});
 const h1=A.confirmedH1(st.bars.H1,now,st.errors.H1?NaN:st.barTimes.H1);
 if(live)journal.observe(s,st.tick,now,{h1Direction:h1.direction,h1Time:h1.time});
 if(candidate.decision!=='WAIT'){
  const saved=journal.record(s,candidate,now,st.tick);
  if(saved&&saved.status==='ACTIVE'){candidate.trade={entry:saved.entry,sl:saved.sl,tp1:saved.tp1,tp2:saved.tp2,tp3:saved.tp3};candidate.score=saved.score;candidate.opportunityType=saved.opportunityType;candidate.stages=saved.stages;candidate.poi=saved.poi;}
  else{candidate.decision='WAIT';candidate.trade={entry:null,sl:null,tp1:null,tp2:null,tp3:null};candidate.why='لا توجد صفقة حالياً. '+(saved?'الإشارة نفسها انتهت؛ ننتظر Trigger جديداً.':'تعذر تسجيل الإشارة؛ راجع تنبيه السجل.');}
 }
 st.analysis=candidate;return candidate;
}
async function refreshTick(s){const st=store[s];if(st.tickBusy)return;st.tickBusy=true;try{const value=D.normalizeTick(await request(s),Date.now());if(!value)throw Error('سعر غير صالح');st.tick=value;delete st.errors.tick;patch(s,Date.now());}catch(e){st.errors.tick=e.name==='AbortError'?'انتهت مهلة الاتصال':e.message;}finally{st.tickBusy=false;processSignal(s,Date.now());render();}}
async function refreshBars(s){const st=store[s];if(st.barBusy)return;st.barBusy=true;st.lastBars=Date.now();try{await Promise.all(frames.map(async name=>{try{const values=D.normalizeBars(await request(s+'/ohlc?interval='+intervals[name]+'&limit=120'),name);if(values.length<55)throw Error('شموع غير كافية');st.bars[name]=values;st.barTimes[name]=Date.now();delete st.errors[name];
 const old=st.live[name]?.slice(-1)[0],current=values[values.length-1],merged=values.map(b=>b.slice());
 if(old&&current&&old[0]===current[0]&&current[5]){const x=merged[merged.length-1];x[2]=Math.max(x[2],old[2]);x[3]=Math.min(x[3],old[3]);}
 st.live[name]=merged;patch(s,Date.now());
 }catch(e){st.errors[name]=e.name==='AbortError'?'انتهت مهلة الاتصال':e.message;}}));}finally{st.barBusy=false;processSignal(s,Date.now());render();}}
function render(){const st=store[asset],now=Date.now(),t=st.tick,live=freshTick(t,now)&&!st.errors.tick;
 const an=processSignal(asset,now);
 $('journalWarning').textContent=journal.error;$('journalWarning').hidden=!journal.error;
 if(historyShown&&lastHistoryRevision!==journal.revision){window.HistoryUI.render(journal);lastHistoryRevision=journal.revision;}
 $('signalScore').textContent='Signal Score: '+an.score+'/100';$('opportunityType').textContent=an.opportunityType||'—';
 $('symbol').textContent=asset;$('price').textContent=A.formatPrice(t?.price);
 const closed=t?.marketState&&!['OPEN','TRADING','ACTIVE'].includes(t.marketState);
 $('feed').textContent=!live?'OFFLINE / STALE':closed?'MARKET CLOSED':t.sourceAt===null?'CONNECTED':'LIVE';
 $('dot').style.background=!live?'var(--bad)':closed?'var(--warn)':'var(--good)';
 const stamp=t?new Date(t.receivedAt).toLocaleTimeString('ar-SA',{hour12:false}):'—';
 $('updated').textContent='آخر استلام: '+stamp+(t?.sourceAt===null?' • وقت المصدر غير متاح':'');
 chip('bias','H1: '+an.bias,an.bias==='BULLISH'?'good':an.bias==='BEARISH'?'bad':'warn');
 chip('decisionChip',an.decision,an.decision==='BUY'?'good':an.decision==='SELL'?'bad':'warn');
 $('decision').textContent=an.decision;$('decision').style.color=an.decision==='BUY'?'var(--good)':an.decision==='SELL'?'var(--bad)':'var(--warn)';
 chip('marketState',t?.marketState||'حالة السوق غير متاحة',closed?'warn':'muted');
 $('reason').textContent=an.why;$('waiting').textContent=an.decision==='WAIT'?an.why:'تم تسجيل الإشارة بمستويات ثابتة. المتابعة بالأسعار المرصودة؛ لا يوجد تنفيذ تداول.';
 for(const k of ['entry','sl','tp1','tp2','tp3'])$(k).textContent=an.decision==='WAIT'?'—':A.formatPrice(an.trade[k]);
 an.stages.forEach(s=>{const e=$(s.tf.toLowerCase());e.textContent=(s.ok?'✓ ':'• ')+s.text;e.style.color=s.ok?'#baf9d9':'#cbd5df';});
 const errors=Object.entries(st.errors);$('err').style.display=errors.length?'block':'none';$('err').textContent=errors.map(([k,v])=>(k==='tick'?'السعر':k)+': '+v).join(' • ');
 const candles=st.live[tf]||st.bars[tf]||[];const count=window.MarketChart.draw($('chart'),candles,tf);
 $('chartLabel').textContent=tf+' • '+count+' شمعة • '+(live&&!closed?'محدّث':'آخر بيانات');
}
$('chart').addEventListener('pointerdown',e=>{const b=window.MarketChart.pick(e.clientX);if(!b)return;$('chartDetails').textContent=new Date(b[0]*1000).toLocaleString('ar-SA-u-ca-gregory')+' | O '+A.formatPrice(b[1])+' H '+A.formatPrice(b[2])+' L '+A.formatPrice(b[3])+' C '+A.formatPrice(b[4]);});
function poll(){const now=Date.now();journal.sweep(now);for(const s of assets){patch(s,now);refreshTick(s);const st=store[s],m1=st.bars.M1||[],lastClosed=m1.filter(b=>!b[5]).slice(-1)[0];const newBar=!lastClosed||lastClosed[0]<Math.floor(now/60000)*60-60;
 if(now-st.lastBars>=(newBar?5000:30000))refreshBars(s);}render();}
for(const id of ['historyAsset','historyMode','historyVersion'])$(id).addEventListener('change',()=>window.HistoryUI.render(journal));
$('exportCSV').addEventListener('click',()=>window.HistoryUI.exportFile(journal,'csv'));$('exportJSON').addEventListener('click',()=>window.HistoryUI.exportFile(journal,'json'));
addEventListener('pagehide',()=>journal.flush());
setAsset(asset);setTF(tf);poll();setInterval(poll,1000);addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();
