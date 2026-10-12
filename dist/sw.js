const CACHE='hf-bird-board-v11';
const scopeUrl=new URL(self.registration.scope);
const shell=[new URL('./',scopeUrl).href,new URL('./index.html',scopeUrl).href,new URL('./manifest.webmanifest',scopeUrl).href,new URL('./icons/bird.svg',scopeUrl).href,new URL('./data/observations.json',scopeUrl).href,new URL('./data/nbn-history.json',scopeUrl).href];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(shell)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hf-bird-board-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==location.origin)return;
 const isFeed=url.pathname.endsWith('/data/observations.json');
 if(isFeed){
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(async()=>await caches.match(request)||new Response(JSON.stringify({source:'offline',records:[]}),{headers:{'Content-Type':'application/json'}})));
  return;
 }
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(new URL('./index.html',scopeUrl).href,response.clone()));return response}).catch(async()=>await caches.match(request)||await caches.match(new URL('./index.html',scopeUrl).href)));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response})));
});
