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
   const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webp')?'image/webp':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
  }catch{res.statusCode=404;res.end('Not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const width of [1440,390,1920]){
   const page=await browser.newPage({viewport:{width,height:width===1920?1080:1000},serviceWorkers:'block'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-11-02T10:00Z')});await page.goto(url);
   await page.locator('.dashboard-shortcuts a[href="#panel-sightings"]').click();
   await page.waitForFunction(()=>document.querySelector('#sightings-coverage').textContent.includes('collected reports'));
   assert.equal(await page.locator('[data-period="30days"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#sightings-month-label').innerText(),/2026-10-04.*2026-11-02/);
   assert(await page.locator('#sightings-rows .sighting-row').count()>0);
   const initial=await page.locator('#bento-sightings-count').innerText();
   for(const period of ['today','week']){
    await page.locator(`[data-period="${period}"]`).click();
    await page.waitForFunction(()=>document.querySelector('#sightings-coverage').textContent.includes('0 collected reports'));
    assert.match(await page.locator('#sightings-rows').innerText(),/No sightings recorded for this period/);
    assert.equal(await page.locator('#bento-sightings-count').innerText(),'0');
   }
   await page.locator('[data-period="30days"]').click();
   await page.waitForFunction(()=>document.querySelector('#sightings-rows .sighting-row'));
   assert.equal(await page.locator('#bento-sightings-count').innerText(),initial);
   assert.equal((await page.locator('#month-title').innerText()).toLowerCase(),'november 2026');
   assert.doesNotMatch(await page.locator('#sightings-rows').innerText(),/Wetland Centre/);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`/private/tmp/hf-rolling-${width}.png`});
   assert.deepEqual(errors,[]);await page.close();console.log(width+'px: rolling periods, summaries, empty state, month isolation, overflow pass');
  }
  for(const scenario of ['unavailable','stale','empty','invalid-archive']){
   const page=await browser.newPage({serviceWorkers:'block'});
   await page.clock.install({time:new Date('2026-11-02T10:00Z')});
   if(scenario==='unavailable'){
    await page.route('**/data/observations.json',r=>r.fulfill({status:503,body:'unavailable'}));
    await page.route('**/sightings-archive/*.json',r=>r.fulfill({status:503,body:'unavailable'}));
   }else if(scenario==='empty'){
    await page.route('**/data/observations.json',r=>r.fulfill({json:{source:'eBird',updatedAt:'2026-11-02T09:00Z',hotspots:[],records:[]}}));
    await page.route('**/sightings-archive/*.json',r=>r.fulfill({status:404,body:'No archive'}));
   }else if(scenario==='invalid-archive')await page.route('**/sightings-archive/*.json',r=>r.fulfill({json:{schemaVersion:1,source:'offline',records:[]}}));
   else await page.route('**/data/observations.json',async r=>{const res=await r.fetch(),json=await res.json();json.updatedAt='2026-10-29T09:00Z';await r.fulfill({json});});
   await page.goto(url);await page.locator('.dashboard-shortcuts a[href="#panel-sightings"]').click();
   await page.waitForFunction(()=>document.querySelector('#sightings-coverage').textContent.includes('collected reports'));
   const status=await page.locator('#sightings-coverage').innerText(),rows=await page.locator('#sightings-rows').innerText();
   if(scenario==='unavailable'){assert.match(status,/feed unavailable/);assert.match(rows,/Sightings data unavailable/);assert.doesNotMatch(rows,/No sightings recorded/);}
   if(scenario==='stale')assert.match(status,/over 48 hours/);
   if(scenario==='empty')assert.match(rows,/No sightings recorded for this period/);
   if(scenario==='invalid-archive'){assert.match(status,/Archives unavailable/);assert(await page.locator('#sightings-rows .sighting-row').count()>0);}
   await page.close();console.log(scenario+': pass');
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
