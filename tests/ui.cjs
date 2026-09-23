const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {scenario,NOW}=require('./fixtures.cjs');
(async()=>{
 const root=path.resolve('app/src/main/assets');
 const server=http.createServer((req,res)=>{if(req.url==='/vendor/signalr.min.js'){res.setHeader('Content-Type','application/javascript');res.end('window.signalR=undefined;');return;}const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox']}: {})});let failures=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await context.addInitScript(({now})=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};},{now:NOW});
  await context.route('https://biquote.io/api/**',async route=>{const u=new URL(route.request().url()),parts=u.pathname.split('/'),symbol=parts[2],s=scenario(symbol,symbol==='BTCUSD');if(!parts[3]){const spread=symbol==='XAUUSD'?.08:2;return route.fulfill({json:{bid:s.tick.price-spread/2,ask:s.tick.price+spread/2,mid:s.tick.price,timestamp:NOW,marketState:'OPEN'}});}const tf={'1m':'M1','5m':'M5','15m':'M15','1h':'M15','4h':'M15'}[u.searchParams.get('interval')];await route.fulfill({json:{bars:s.bars[tf].map(([t,o,h,l,c,isOpen])=>({openTime:new Date(t*1000).toISOString(),open:o,high:h,low:l,close:c,isOpen}))}});});
  const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.getElementById('journalStatus').textContent.includes('السجل متاح'),{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('decision').textContent==='WAIT',{timeout:30000});
  // V2.1 is deliberately fail-closed: with no validated model, cold start MUST be WAIT.
  assert.equal(await page.locator('#decision').innerText(),'WAIT');
  assert.equal(await page.locator('#aiMode').innerText(),'COLLECTING');
  assert.match(await page.locator('#aiReason').innerText(),/ليست نسبة نجاح/);
  for(const name of ['M1','M3','M5','M15','H1','H4'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
  for(const id of ['stTp2','chartNow','missedHistory','toolTrend','toolRay','toolEma','toolRsi','exportAiCsv','exportDecisions','trainModel','decisionHistory'])assert.equal(await page.locator('#'+id).count(),1);
  assert.match(await page.locator('#journalStatus').innerText(),/السجل متاح/);
  // The price feed can be live while invalid H1/H4 history still forces AI WAIT.
  assert.match(await page.locator('#feed').innerText(),/LIVE/);
  assert.equal(await page.locator('#decision').innerText(),'WAIT');
  await page.locator('#btcTab').click();await page.waitForFunction(()=>document.getElementById('symbol').textContent==='BTCUSD');
  assert.equal(await page.locator('#decision').innerText(),'WAIT');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.locator('#goldTab').click();
  const imported=process.env.REAL_EXPORT?JSON.parse(fs.readFileSync(process.env.REAL_EXPORT,'utf8')):{version:2,decisions:require('./pipeline-fixtures.cjs').dataset()};
  if(!process.env.REAL_EXPORT)Object.assign(imported.decisions[0].ai,{decision:'BUY',reason:'LEARNED_EDGE',modelId:'verified-fixture'});
  await page.locator('#importDecisionFile').setInputFiles({name:'journal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.waitForFunction(()=>document.getElementById('trainingStatus').textContent.includes('تم الاستيراد'));
  assert.equal(await page.locator('#missTotal').innerText(),'0','an imported model claim is not locally verified');
  await page.locator('#trainModel').click();
  const expected=process.env.REAL_EXPORT?'INSUFFICIENT_VALIDATION_TRADES':'PROMOTED';
  await page.waitForFunction(expected=>document.getElementById('trainingStatus').textContent.includes(expected),expected);
  assert.match(await page.locator('#trainingStatus').innerText(),/Train .*Validation .*Test/);
  if(process.env.REAL_EXPORT){assert.match(await page.locator('#aiSamples').innerText(),/48/);await page.locator('#btcTab').click();await page.locator('#trainModel').click();await page.waitForFunction(()=>document.getElementById('trainingStatus').textContent.includes('NO_PROVEN_IMPROVEMENT'));}
  else {
   assert.equal(await page.locator('#aiMode').innerText(),'VALIDATED');
   const {row}=require('./pipeline-fixtures.cjs'),blocked=row(101),observed=row(102);
   for(const r of [blocked,observed])Object.assign(r.ai,{decision:'BUY',reason:'LEARNED_EDGE',modelId:'XAUUSD-'+NOW});
   blocked.positions={};blocked.safety={ok:false,reasons:['SPREAD']};
   observed.safety={ok:false,reasons:['DUPLICATE_BAR']};
   await page.locator('#importDecisionFile').setInputFiles({name:'blocked.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,decisions:[blocked,observed]}))});
   await page.waitForFunction(()=>document.getElementById('trainingStatus').textContent.includes('تم الاستيراد'));
   assert.equal(await page.locator('#missTotal').innerText(),'2','tracked and unobserved blocked model choices both count');
   assert.equal(await page.locator('#missWin').innerText(),'100%','only observed outcomes enter the win rate');
   const csvDownload=page.waitForEvent('download');await page.locator('#exportAiCsv').click();
   const csvFile=await csvDownload;const csvText=fs.readFileSync(await csvFile.path(),'utf8');
   assert.match(csvText.split('\r\n')[0],/"entry"/,'a first unobserved opportunity cannot remove observed columns from CSV');
  }
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('journalStatus').textContent.includes('السجل متاح'));
  assert.match(await page.locator('#trainingStatus').innerText(),process.env.REAL_EXPORT?/NO_PROVEN_IMPROVEMENT/:/PROMOTED/);
  if(!process.env.REAL_EXPORT)assert.equal(await page.locator('#missTotal').innerText(),'2','locally verified archived model survives reload');
  // Android file:// can reject Worker construction synchronously.
  await page.evaluate(()=>{window.Worker=class{constructor(){throw new Error('SecurityError');}};});
  await page.locator('#trainModel').click();
  await page.waitForFunction(()=>document.getElementById('trainingStatus').textContent.includes('NEED_NEW_HOLDOUT'));
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/scalp-mobile-v21.png',fullPage:true});
  assert.deepEqual(failures,[]);console.log('PASS: cold-start WAIT, import, training/holdout, worker fallback, reload persistence, six frames and responsive UI.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
