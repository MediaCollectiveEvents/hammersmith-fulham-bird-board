// Optional local regression. Set PLAYWRIGHT_MODULE to an installed Playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'../dist');
(async()=>{
 const server=http.createServer(async(req,res)=>{
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+path.sep))throw Error('Path');
   const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
  }catch{res.statusCode=404;res.end('Not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const sept=JSON.parse(await fs.readFile(path.join(root,'data/sightings-archive/2026-09.json'))),oct=JSON.parse(await fs.readFile(path.join(root,'data/sightings-archive/2026-10.json')));
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-10-31T12:00:00Z')});await page.goto(url);
   await page.locator('#section-menu [data-category="actual"]').click();
   await page.waitForFunction(expected=>document.querySelector('#sightings-coverage').textContent.includes(expected),`${oct.records.length} collected reports`);
   assert.equal(await page.locator('#sightings-period').inputValue(),'this');
   await page.locator('#sightings-period').selectOption('last');
   await page.waitForFunction(expected=>document.querySelector('#sightings-coverage').textContent.includes(expected),`${sept.records.length} collected reports`);
   assert.equal(await page.locator('#sightings-month-label').innerText(),'September 2026');
   assert.equal((await page.locator('#month-title').innerText()).toLowerCase(),'september 2026');
   assert.equal(Number(await page.locator('#bento-sightings-count').innerText()),sept.totals.species);
   assert.match(await page.locator('#sightings-coverage').innerText(),new RegExp(sept.totals.lastRecorded));
   await page.locator('[data-open-panel="panel-sightings"]').click();
   assert.match(await page.locator('#sightings-rows').innerText(),/Last recorded 2026-09-/);
   assert.doesNotMatch(await page.locator('#sightings-rows').innerText(),/Last recorded 2026-10-/);
   await page.locator('[data-open-panel="panel-hotspots"]').click();
   assert.match(await page.locator('#hotspot-L939893').innerText(),/11 species · 11 species reports/);
   assert.doesNotMatch(await page.locator('#hotspot-totals').innerText(),/WWT|Wetland Centre/);
   await page.locator('#sightings-period-controls').scrollIntoViewIfNeeded();
   await page.screenshot({path:`/private/tmp/hf-monthly-selector-${width}.png`});
   await page.locator('#sightings-period').selectOption('this');
   await page.waitForFunction(expected=>document.querySelector('#sightings-coverage').textContent.includes(expected),`${oct.records.length} collected reports`);
   assert.equal(Number(await page.locator('#bento-sightings-count').innerText()),oct.totals.species);
   await page.locator('#section-menu [data-category="expected"]').click();
   assert.equal((await page.locator('#month-title').innerText()).toLowerCase(),'october 2026');
   assert.equal(await page.locator('#sightings-period-controls').isVisible(),false);
   assert.deepEqual(errors,[]);await page.close();console.log(width+'px: current/previous month, dates, totals, Ravenscourt, WWT and movement-board isolation pass');
  }
  for(const scenario of ['missing','failed-live','invalid-archive','rollover']){
   const context=await browser.newContext({serviceWorkers:'block',timezoneId:'America/Los_Angeles'}),page=await context.newPage();
   await page.clock.install({time:new Date(scenario==='missing'?'2027-01-01T12:00:00Z':scenario==='rollover'?'2026-11-01T00:30:00Z':'2026-10-31T12:00:00Z')});
   if(scenario==='failed-live')await page.route('**/data/observations.json',route=>route.fulfill({status:503,body:'Unavailable'}));
   if(scenario==='invalid-archive')await page.route('**/sightings-archive/2026-09.json',route=>route.fulfill({json:{...sept,month:'2025-09'}}));
   await page.goto(url);await page.locator('#section-menu [data-category="actual"]').click();
   await page.waitForFunction(()=>!document.querySelector('#sightings-coverage').textContent.includes('Loading')&&document.querySelector('#sightings-coverage').textContent.length>0);
   if(scenario==='rollover')assert.equal(await page.locator('#sightings-month-label').innerText(),'November 2026');
   await page.locator('#sightings-period').selectOption('last');
   await page.waitForFunction(()=>!document.querySelector('#sightings-coverage').textContent.includes('Loading')&&document.querySelector('#sightings-coverage').textContent.length>0);
   const text=await page.locator('#sightings-coverage').innerText();
   if(scenario==='missing'){assert.match(text,/No collected archive/);assert.equal(await page.locator('#bento-sightings-count').innerText(),'0');}
   else if(scenario==='invalid-archive')assert.match(text,/Archive unavailable; showing partial records retained/);
   else if(scenario==='failed-live')assert(text.includes(`${sept.records.length} collected reports`));
   else assert(text.includes(`${oct.records.length} collected reports`));
   await context.close();console.log(scenario+': pass');
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
