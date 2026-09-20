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
 let goldFailed=false,waitOnly=false,marketClosed=false;
 await context.route('https://biquote.io/api/**',async route=>{const u=new URL(route.request().url()),parts=u.pathname.split('/'),symbol=parts[2],s=scenario(symbol,symbol==='BTCUSD');if(symbol==='XAUUSD'&&goldFailed&&!parts[3])return route.fulfill({status:503,body:'offline'});
 if(!parts[3])return route.fulfill({json:{mid:s.tick.price,timestamp:NOW,marketState:marketClosed?'CLOSED':'OPEN'}});
 const tf={'1m':'M1','5m':'M5','15m':'M15','1h':'H1','4h':'H4'}[u.searchParams.get('interval')];if(waitOnly&&tf==='M1'){const b=s.bars.M1.at(-1);b[4]=b[1];}
 await route.fulfill({json:{bars:s.bars[tf].map(([t,o,h,l,c,isOpen])=>({openTime:new Date(t*1000).toISOString(),open:o,high:h,low:l,close:c,isOpen}))}});
 });
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
 const url='http://127.0.0.1:'+server.address().port;
 await page.goto(url);await page.waitForFunction(()=>document.getElementById('decision').textContent==='BUY');
 assert.equal(await page.locator('#entry').innerText(),'3012.000');
 await page.getByRole('button',{name:'H4',exact:true}).click();assert.match(await page.locator('#chartLabel').innerText(),/^H4 • 24/);
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
 await page.setViewportSize({width:390,height:844});await page.locator('#chart').tap({position:{x:80,y:150}});assert.match(await page.locator('#chartDetails').innerText(),/O .* H .* L .* C /);
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/mobile-h4.png',fullPage:true});
 await page.getByRole('button',{name:'H1',exact:true}).click();await page.screenshot({path:'test-results/mobile-h1.png',fullPage:true});
 await page.locator('#btcTab').click();await page.waitForFunction(()=>document.getElementById('decision').textContent==='SELL');assert.equal(await page.locator('#entry').innerText(),'59760.00');
 goldFailed=true;await page.locator('#goldTab').click();await page.waitForFunction(()=>document.getElementById('decision').textContent==='WAIT');
 for(const id of ['entry','sl','tp1','tp2','tp3'])assert.equal(await page.locator('#'+id).innerText(),'—');assert.match(await page.locator('#waiting').innerText(),/لا توجد صفقة حالياً/);
 await page.locator('#btcTab').click();assert.equal(await page.locator('#decision').innerText(),'SELL','Gold failure must not disable Bitcoin');
 goldFailed=false;waitOnly=true;await page.reload();await page.waitForFunction(()=>document.getElementById('price').textContent!=='—');await page.waitForTimeout(300);
 assert.equal(await page.locator('#decision').innerText(),'WAIT');for(const id of ['entry','sl','tp1','tp2','tp3'])assert.equal(await page.locator('#'+id).innerText(),'—');
 await page.screenshot({path:'test-results/mobile-wait.png',fullPage:true});
 marketClosed=true;await page.reload();await page.waitForTimeout(800);await page.getByRole('button',{name:'M1',exact:true}).click();assert.equal(await page.evaluate(()=>MarketChart.pick(10000)[0]),Math.floor(NOW/60000)*60-60,'CLOSED market must not create a synthetic current candle');
 assert.deepEqual(failures,[]);console.log('PASS: mobile BUY/SELL/WAIT; no phantom levels; asset isolation; network error; H1/H4; touch; 320/390/430px layout; no JS exceptions.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
