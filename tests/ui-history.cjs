const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{scenario,NOW}=require('./fixtures.cjs');
const KEY='market-ai.signal-history.v1';
(async()=>{
 const root=path.resolve('app/src/main/assets');
 const server=http.createServer((req,res)=>{const f=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 await ctx.addInitScript(now=>{window.__journalNow=now;const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.__journalNow]));}static now(){return window.__journalNow;}};},NOW);
 let now=NOW,prices={XAUUSD:3012,BTCUSD:59760};
 await ctx.route('https://biquote.io/api/**',async route=>{const u=new URL(route.request().url()),p=u.pathname.split('/'),s=scenario(p[2],p[2]==='BTCUSD');
 if(!p[3])return route.fulfill({json:{mid:prices[p[2]],timestamp:now,marketState:'OPEN'}});
 const tf={'1m':'M1','5m':'M5','15m':'M15','1h':'H1','4h':'H4'}[u.searchParams.get('interval')];
 return route.fulfill({json:{bars:s.bars[tf].map(([t,o,h,l,c,isOpen])=>({openTime:new Date(t*1000).toISOString(),open:o,high:h,low:l,close:c,isOpen}))}});
 });
 let page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+server.address().port;
 await page.goto(url);await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{"records":[]}').records.length===2,KEY);
 let records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).records,KEY);const gold=records.find(r=>r.symbol==='XAUUSD'),btc=records.find(r=>r.symbol==='BTCUSD');assert.equal(gold.direction,'BUY');assert.equal(btc.direction,'SELL');
 for(const key of ['tp1','tp2','tp3']){now+=1000;prices.XAUUSD=gold[key];await page.evaluate(t=>window.__journalNow=t,now);await page.waitForFunction(({key,K})=>JSON.parse(localStorage.getItem(K)).records.find(r=>r.symbol==='XAUUSD').result===key.toUpperCase(),{key,K:KEY});}
 now+=1000;prices.BTCUSD=btc.sl;await page.evaluate(t=>window.__journalNow=t,now);await page.waitForFunction(K=>JSON.parse(localStorage.getItem(K)).records.find(r=>r.symbol==='BTCUSD').result==='SL',KEY);
 await page.locator('#historyNav').click();await page.waitForSelector('#historyPage:visible');assert.equal(await page.locator('.history-record').count(),2);assert.ok(await page.locator('#marketPage').isHidden());assert.match(await page.locator('#historyStats').innerText(),/50\.0%/);
 for(const w of [320,390,430]){await page.setViewportSize({width:w,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`history overflow ${w}`);}
 await page.setViewportSize({width:390,height:844});await page.locator('#historyAsset').selectOption('XAUUSD');assert.equal(await page.locator('.history-record').count(),1);assert.match(await page.locator('#historyStats').innerText(),/100\.0%/);await page.locator('.history-record summary').click();
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/signal-history.png',fullPage:true});
 for(const format of ['JSON','CSV']){const downloadPromise=page.waitForEvent('download');await page.locator('#export'+format).click();const d=await downloadPromise;const f='test-results/signals.'+format.toLowerCase();await d.saveAs(f);const contents=fs.readFileSync(f,'utf8');if(format==='JSON'){const data=JSON.parse(contents);assert.equal(data.records.length,2);assert.equal(data.records[0].version,'2.1.0');}else{assert.ok(contents.includes(gold.id));assert.ok(contents.includes(btc.id));}}
 // A fresh page shares real browser storage; no seeded history or mocked storage.
 await page.close();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(K=>JSON.parse(localStorage.getItem(K)).records.length===2,KEY);await page.locator('#historyNav').click();assert.equal(await page.locator('.history-record').count(),2);assert.match(await page.locator('#historyList').innerText(),/TP3/);assert.match(await page.locator('#historyList').innerText(),/SL/);
 // Test SAF dispatch boundary; actual file picker is provided by Android.
 await page.evaluate(()=>{window.AndroidExports={exportReport:(format,data)=>{window.__nativeExport={format,data};}};});await page.locator('#exportJSON').click();const native=await page.evaluate(()=>window.__nativeExport);assert.equal(native.format,'json');assert.equal(JSON.parse(native.data).records.length,2);
 assert.deepEqual(errors,[]);console.log('PASS: automatic two-asset journal, fixed levels, TP1/2/3 and SL updates, filters/stats, full JSON/CSV downloads, native export dispatch, persistence after page close, no duplicates, mobile layouts.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
