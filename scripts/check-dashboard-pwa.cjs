// Optional real-service-worker check. No production hosting is contacted.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const os=require('node:os');
const root=path.resolve(__dirname,'../dist');
(async()=>{
 let release='before';const original=new Map();
 for(const file of ['index.html','dashboard.css','dashboard.mjs','sw.js'])original.set('/'+file,execFileSync('git',['show',`cf58096:dist/${file}`],{cwd:path.dirname(root)}));
 original.set('/',original.get('/index.html'));
 const server=http.createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('Path');
  const data=release==='before'&&original.has(pathname)?original.get(pathname):await fs.readFile(file);
  res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.json')||file.endsWith('.webmanifest')?'application/json':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.end('Not found');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'hf-pwa-check-'));
 const browser=await chromium.launchPersistentContext(profile,{headless:true,channel:'chrome',viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
 try{
  const context=browser,page=await context.newPage();
  await page.addInitScript(()=>window.addEventListener('beforeinstallprompt',()=>window.__installPromptSeen=true));
  await page.clock.install({time:new Date('2026-10-31T12:00Z')});await page.goto(url);await page.waitForSelector('.news-lead');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  assert((await page.evaluate(()=>caches.keys())).includes('hf-bird-board-v35'));
  const session=await context.newCDPSession(page);await session.send('Page.enable');await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
  const manifest=await session.send('Page.getAppManifest');assert.equal(manifest.errors.length,0);const parsed=JSON.parse(manifest.data);assert.equal(parsed.display,'standalone');assert.equal(parsed.start_url,'./');
  console.log('Manifest valid; scope/start URL and active service worker verified.');
  const installability=await session.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);await page.waitForFunction(()=>window.__installPromptSeen===true);console.log('Installability: no Chromium errors; genuine beforeinstallprompt received; install control visible: '+await page.locator('#install-button').isVisible());
  console.log('Native installation UI/app launch cannot be verified in headless Chrome.');
  release='after';await page.evaluate(async()=>{const old=navigator.serviceWorker.controller,registration=await navigator.serviceWorker.getRegistration();const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>{if(navigator.serviceWorker.controller!==old)resolve();}));await registration.update();await changed;});
  await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('hf-bird-board-v36')&&!keys.includes('hf-bird-board-v35');});
  await page.reload();await page.waitForSelector('.dashboard-shortcuts');await page.waitForSelector('.news-lead');
  assert(await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return navigator.serviceWorker.controller===r.active&&r.active.state==='activated';}));
  console.log('Update: v35 → v36 activates, old cache removed, new shortcuts load.');
  // Warm the retained month through its real user flow, then wait for cache writes.
  await page.locator('.dashboard-shortcuts a[href="#panel-sightings"]').click();await page.locator('#sightings-period').selectOption('last');await page.waitForFunction(()=>document.querySelector('#sightings-coverage').textContent.includes('97 collected reports'));
  await page.waitForFunction(async()=>{const cache=await caches.open('hf-bird-board-v36');const urls=(await cache.keys()).map(r=>r.url);return ['index.html','dashboard.css','dashboard.mjs','seasonality_metadata.json','species_migration_calendar.csv','sightings-archive/2026-09.json'].every(file=>urls.some(u=>u.endsWith('/'+file)));});
  await context.setOffline(true);await page.reload();try{await page.waitForSelector('.news-lead',{timeout:10000});}catch(e){console.log('Offline state: '+await page.locator('#bird-news-grid').textContent());console.log(await page.evaluate(async()=>{return await Promise.all(['ebird-history.json','bird-rankings.json','species_migration_calendar.csv','seasonality_metadata.json','observations.json'].map(async f=>{try{const r=await fetch('./data/'+f);return [f,r.status,(await r.text()).slice(0,180)];}catch(e){return [f,e.message];}}));}));throw e;}await page.waitForSelector('.dashboard-shortcuts');
  assert.equal(await page.locator('#month-title').textContent(),'October 2026');assert.match(await page.locator('#dashboard-summary').innerText(),/191/);
  await page.locator('.dashboard-shortcuts a[href="#panel-sightings"]').click();await page.locator('#sightings-period').selectOption('last');await page.waitForFunction(()=>document.querySelector('#sightings-coverage').textContent.includes('97 collected reports'));
  assert.equal(await page.locator('#sightings-month-label').innerText(),'September 2026');assert.equal(await page.locator('#month-title').textContent(),'October 2026');
  await page.screenshot({path:'/private/tmp/hf-dashboard-pwa-offline.png'});
  console.log('Offline warm-cache reload: news, styles, current totals, shortcuts and retained September archive pass.');
  
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
