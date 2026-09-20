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
  await context.addInitScript(({now})=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};},{now:NOW});
  await context.route('https://biquote.io/api/**',async route=>{const u=new URL(route.request().url()),parts=u.pathname.split('/'),symbol=parts[2],s=scenario(symbol,symbol==='BTCUSD');if(!parts[3])return route.fulfill({json:{mid:s.tick.price,timestamp:NOW,marketState:'OPEN'}});const tf={'1m':'M1','5m':'M5','15m':'M15'}[u.searchParams.get('interval')];await route.fulfill({json:{bars:s.bars[tf].map(([t,o,h,l,c,isOpen])=>({openTime:new Date(t*1000).toISOString(),open:o,high:h,low:l,close:c,isOpen}))}});});
  const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>['BUY','SELL'].includes(document.getElementById('decision').textContent));
  assert.equal(await page.locator('#decision').innerText(),'BUY');
  assert.equal(await page.getByRole('button',{name:'M15',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'M5',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'M1',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'H1',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'H4',exact:true}).count(),0);assert.equal(await page.locator('#stTp2').count(),1);assert.equal(await page.locator('#chartNow').count(),1);assert.equal(await page.locator('#missedHistory').count(),1);
  await page.locator('#btcTab').click();await page.waitForFunction(()=>document.getElementById('decision').textContent==='SELL');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/scalp-mobile.png',fullPage:true});
  assert.deepEqual(failures,[]);console.log('PASS: scalp M15/M5/M1 UI, BUY/SELL, responsive, no H1/H4.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
