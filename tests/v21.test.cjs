const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis.js');
const F=require('../app/src/main/assets/features.js');
const T=require('../app/src/main/assets/trainer.js');
const {scenario}=require('./fixtures.cjs');
test('scalp targets are shorter than official swing targets',()=>{const s=scenario();delete s.bars.H4;delete s.bars.H1;const r=A.analyze(s);assert.equal(r.decision,'BUY');const risk=r.trade.entry-r.trade.sl;assert.ok(Math.abs((r.trade.tp1-r.trade.entry)/risk-.75)<.01);assert.ok(Math.abs((r.trade.tp3-r.trade.entry)/risk-1.8)<.01);});
test('XAUUSD M15 accepts a real session break but rejects missing intraday candles',()=>{assert.equal(F.gapKind('XAUUSD','M15',4500,900,Date.UTC(2026,8,14,20,45)/1000),'SESSION');assert.equal(F.gapKind('XAUUSD','M15',1800,900,Date.UTC(2026,8,14,10)/1000),'BAD');assert.equal(F.gapKind('BTCUSD','M15',8*3600,900),'BAD');});
test('AI cold start is reduced but still requires temporal validation and test',()=>{assert.equal(T.MIN_ROWS,40);assert.ok(T.MIN_TRAIN>=20);assert.ok(T.MIN_VALIDATION>=6);assert.ok(T.MIN_TEST>=6);assert.ok(T.MIN_TRADES>=2);});

test('trainer reserves larger independent validation and test windows',()=>{const rows=[];for(let i=0;i<40;i++)rows.push({id:'r'+i,parentId:'p'+i,at:i*100000,closedAt:i*100000+1000});const p=T.partition(rows);assert.equal(p.test.length,10);assert.ok(p.validation.length>=9);});

test('derived XAUUSD M15 rejects intraday holes and accepts only real session gaps',()=>{const prev=Date.UTC(2026,8,22,9)/1000,last=prev+1800,now=(last+600)*1000;assert.equal(F.usableGap('XAUUSD','M15',1800,900,prev,now,last),'BAD');const sessionPrev=Date.UTC(2026,8,14,20,45)/1000;assert.equal(F.usableGap('XAUUSD','M15',4500,900,sessionPrev,now,last),'SESSION');});
test('trainer searches temporal boundaries after embargo',()=>{const rows=[];for(let i=0;i<48;i++)rows.push({id:'e'+i,parentId:'e'+i,at:i*120000,closedAt:i*120000+70000});const p=T.partition(rows);assert.ok(p.train.length>=20);assert.ok(p.validation.length>=6);assert.ok(p.test.length>=6);});

test('trainer calibration never promotes a negative predicted edge',()=>{const src=require('fs').readFileSync(require('path').join(__dirname,'../app/src/main/assets/trainer.js'),'utf8');assert.match(src,/\[0,\.025,\.05,\.1,\.2,\.3\]/);assert.doesNotMatch(src,/\[-\.5,-\.25/);});
test('app fetches native history and derives canonical M3 and M15',()=>{const src=require('fs').readFileSync(require('path').join(__dirname,'../app/src/main/assets/app.js'),'utf8');const decl=src.split('\n').find(line=>line.includes('intervals={'));assert.ok(decl);for(const token of ["M1:'1m'","M5:'5m'","H1:'1h'","H4:'4h'"])assert.ok(decl.includes(token));assert.equal(decl.includes("M15:'15m'"),false);assert.ok(src.includes("st.bars.M3=D.aggregate(st.bars.M1||[],180,60)"));assert.ok(src.includes("st.bars.M15=D.aggregate(st.bars.M5||[],900,300)"));assert.equal(src.includes("D.aggregate(st.bars.M1||[],3600,60)"),false);assert.equal(src.includes("D.aggregate(st.bars.M1||[],14400,60)"),false);});


test('partition keeps both side outcomes atomic across embargo boundaries',()=>{const rows=[];for(let i=0;i<24;i++){const at=i*300000;rows.push({id:'a'+i+'b',parentId:'p'+i,at,closedAt:at+30000});rows.push({id:'a'+i+'s',parentId:'p'+i,at,closedAt:at+(i===12?900000:40000)});}const p=T.partition(rows);for(const bucket of [p.train,p.validation,p.test]){const counts=new Map();for(const r of bucket)counts.set(r.parentId,(counts.get(r.parentId)||0)+1);assert.ok([...counts.values()].every(n=>n===2));}});
test('canonical derived frames block signals when recent M3 history is incomplete',()=>{const s=scenario(),end=Math.floor(s.now/180000)*180000/1000-180,sec=180;s.bars.M3=Array.from({length:70},(_,i)=>[end-(69-i)*sec,100,102,99,101,false]);s.bars.M3.splice(50,1);const r=F.snapshot(s);assert.equal(r.ok,false);assert.equal(r.reason,'GAP_M3');assert.equal(r.gap.contiguousBars,19);});
