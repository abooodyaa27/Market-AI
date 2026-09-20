const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {scenario,NOW}=require('./fixtures.cjs');
(async()=>{
 const root=path.resolve('app/src/main/assets');
 const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});let failures=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await context.addInitScript(({now})=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};indexedDB.deleteDatabase('market-ai-v2');},{now:NOW});
  await context.route('https://biquote.io/api/**',async route=>{const u=new URL(route.request().url()),parts=u.pathname.split('/'),symbol=parts[2],s=scenario(symbol,symbol==='BTCUSD');if(!parts[3]){const spread=symbol==='XAUUSD'?.08:2;return route.fulfill({json:{bid:s.tick.price-spread/2,ask:s.tick.price+spread/2,mid:s.tick.price,timestamp:NOW,marketState:'OPEN'}});}const tf={'1m':'M1','5m':'M5','15m':'M15','1h':'M15','4h':'M15'}[u.searchParams.get('interval')];await route.fulfill({json:{bars:s.bars[tf].map(([t,o,h,l,c,isOpen])=>({openTime:new Date(t*1000).toISOString(),open:o,high:h,low:l,close:c,isOpen}))}});});
  const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.getElementById('feed').textContent==='LIVE',{timeout:30000});
  // V2.1 is deliberately fail-closed: with no validated model, cold start MUST be WAIT.
  assert.equal(await page.locator('#decision').innerText(),'WAIT');
  assert.equal(await page.locator('#aiMode').innerText(),'COLLECTING');
  assert.match(await page.locator('#aiReason').innerText(),/ليست نسبة نجاح/);
  for(const name of ['M1','M3','M5','M15','H1','H4'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
  for(const id of ['stTp2','chartNow','missedHistory','toolTrend','toolRay','toolEma','toolRsi','exportAiCsv','exportDecisions','trainModel','decisionHistory'])assert.equal(await page.locator('#'+id).count(),1);
  assert.match(await page.locator('#journalStatus').innerText(),/السجل متاح/);
  await page.locator('#btcTab').click();await page.waitForFunction(()=>document.getElementById('symbol').textContent==='BTCUSD');
  assert.equal(await page.locator('#decision').innerText(),'WAIT');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/scalp-mobile-v21.png',fullPage:true});
  assert.deepEqual(failures,[]);console.log('PASS: V2.1 cold-start WAIT + six frames + safety/journal controls + responsive UI.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});