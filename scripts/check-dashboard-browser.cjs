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
  for(const width of [1440,390,768,1920]){
   const page=await browser.newPage({viewport:{width,height:width===1920?1080:width===390?844:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
   await page.clock.install({time:new Date('2026-10-31T12:00:00Z')});await page.goto(url);
   await page.waitForSelector('.news-lead');await page.waitForSelector('.rich-movement');
   assert.equal(await page.locator('#arrivals-rows>.row').count(),1);assert.equal(await page.locator('#departures-rows>.row').count(),3);
   assert.equal(await page.locator('#dashboard-month').innerText(),'October 2026');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(errors,[]);
   const shortcuts=page.locator('.dashboard-shortcuts');assert((await shortcuts.boundingBox()).y<250);console.log(width+'px quick navigation: '+JSON.stringify(await shortcuts.boundingBox()));
   for(const label of ['Sightings','Movements','Rankings','Hotspots','Historical Records']){
    const link=shortcuts.getByRole('link',{name:label,exact:true});await link.focus();await page.keyboard.press('Enter');const id=(await link.getAttribute('href')).slice(1);console.log(width+'px shortcut '+label);await page.waitForFunction(id=>{const p=document.getElementById(id),b=p.querySelector(':scope>summary').getBoundingClientRect();return p.open&&b.top>=0&&b.bottom<=innerHeight&&document.activeElement===p.querySelector(':scope>summary');},id);
   }
   await page.locator('#section-menu [data-category=all]').click();
   const colours=await page.evaluate(()=>({green:getComputedStyle(document.documentElement).getPropertyValue('--brand-green').trim(),yellow:[...document.querySelectorAll('body *')].filter(el=>!el.closest('#panel-movements')&&getComputedStyle(el).display!=='none'&&[getComputedStyle(el).color,getComputedStyle(el).backgroundColor,getComputedStyle(el).borderTopColor].includes('rgb(240, 237, 0)')).map(el=>el.id||el.className)}));assert.equal(colours.green,'#216e4b');assert.deepEqual(colours.yellow,[]);
   await page.locator('#here-toggle').click();assert.equal(await page.locator('#here-rows>.row:visible').count(),17);await page.locator('#here-toggle').click();assert.equal(await page.locator('#here-rows>.row:visible').count(),3);
   await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});await page.screenshot({path:`/private/tmp/hf-dashboard-after-${width}.png`,fullPage:true});await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});await page.waitForTimeout(100);await page.screenshot({path:`/private/tmp/hf-dashboard-after-preview-${width}.png`});
   await page.keyboard.press('Tab');await page.locator('#arrivals-rows [data-bird-species]').first().focus();assert.equal(await page.locator('#arrivals-rows [data-bird-species]').first().evaluate(el=>getComputedStyle(el).outlineStyle),'solid');await page.keyboard.press('Enter');await page.waitForSelector('.bird-card[open] .card-seasonality');
   await page.keyboard.press('Escape');
   if(width===1920){
    await page.locator('#tv-button').click();await page.locator('#start-tv').click();await page.waitForFunction(()=>document.fullscreenElement);
    const sizes=await page.evaluate(()=>Object.fromEntries(['.species .bird-species-trigger','.latin','.window','.direction','.season-timeline','.timeline-key'].map(sel=>[sel,parseFloat(getComputedStyle(document.querySelector('#arrivals-rows '+sel)).fontSize)])));
    assert(sizes['.species .bird-species-trigger']>=32);assert(sizes['.latin']>=22);assert(sizes['.window']>=24);assert(sizes['.season-timeline']>=22);assert(sizes['.timeline-key']>=20);console.log('TV measured pixels: '+JSON.stringify(sizes));
    const seen=new Set();let pages=0;
    do{
     await page.waitForTimeout(50);
     const state=await page.evaluate(()=>{const screen=document.documentElement.dataset.tvScreen;const ids={arrivals:'arrivals-rows',departures:'departures-rows',here:'here-rows',sightings:'sightings-rows',birdweather:'birdweather-rows'};const list=document.getElementById(ids[screen]);const rows=[...list.children].filter(r=>!r.hidden);return {screen,rows:rows.map(r=>{const b=r.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height}}),list:list.getBoundingClientRect().toJSON(),height:innerHeight};});
     seen.add(state.screen);pages++;assert.equal(await page.locator('#arrivals-board:visible,#departures-board:visible,#here-board:visible,#tv-sightings:visible,#tv-birdweather:visible').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     assert(state.rows.every(r=>r.bottom<=state.list.bottom+1),'Row clipped within table');
     assert(state.rows.length>0);
     for(const row of state.rows){assert(row.top>=0);assert(row.bottom<=state.height-5,`Clipped ${state.screen} row: ${row.bottom}/${state.height}`);}
     if(pages===1||state.screen==='here'&&!seen.has('here-shot')){await page.screenshot({path:`/private/tmp/hf-dashboard-after-tv-${state.screen}.png`});if(state.screen==='here')seen.add('here-shot');}
     if(await page.locator('#tv-next').isDisabled())break;
     assert(pages<150);await page.locator('#tv-next').click();
    }while(true);
    assert(seen.has('here'));assert(seen.has('birdweather'));await page.locator('#tv-prev').click();await page.locator('#tv-exit').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('tv-mode'));
    assert.equal(await page.locator('#here-rows>.row[hidden]').count(),0);console.log(`TV: ${pages} pages, all five views pass`);
   }
   assert.deepEqual(errors,[]);await page.close();console.log(width+'px dashboard pass');
  }
  for(const scenario of ['missing-images','failed-release','failed-archive']){
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await page.clock.install({time:new Date('2026-10-31T12:00Z')});
   if(scenario==='missing-images')await page.route('**/data/bird-images.json',r=>r.fulfill({status:503,body:'Unavailable'}));
   if(scenario==='failed-release')await page.route('**/data/seasonality_metadata.json',r=>r.fulfill({json:{status:'FAILED'}}));
   if(scenario==='failed-archive')await page.route('**/sightings-archive/2026-09.json',r=>r.fulfill({status:503,body:'Unavailable'}));
   await page.goto(url);
   if(scenario==='failed-release')await page.waitForFunction(()=>document.querySelector('#migration-context').textContent.includes('withheld'));
   else{await page.waitForSelector('.news-lead');if(scenario==='missing-images')assert(await page.locator('.photo-fallback').count()>0);else assert(!await page.locator('#bird-news-grid').innerText().then(t=>t.includes('First retained seasonal report')));}
   await page.close();console.log(scenario+': pass');
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
