import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const script=await fs.readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
for(const [name,url,mode,key] of [
 ['publication metadata','https://birds.test/data/seasonality_metadata.json','cors','https://birds.test/data/seasonality_metadata.json'],
 ['ordinary cached assets','https://birds.test/asset.json','cors','https://birds.test/asset.json'],
 ['navigation fallback','https://birds.test/','navigate','https://birds.test/index.html']
])test('service worker preserves '+name+' when the page consumes the network response before cache opens',async()=>{
 const handlers=new Map(),stored=new Map();let offline=false;const calls=[];
 const caches={match:async r=>stored.get(typeof r==='string'?r:r.url)?.clone(),open:async()=>{await new Promise(resolve=>setTimeout(resolve,5));return {put:async(r,response)=>{stored.set(typeof r==='string'?r:r.url,response);}};}};
 vm.runInNewContext(script,{URL,Response,location:{origin:'https://birds.test'},self:{registration:{scope:'https://birds.test/'},addEventListener:(type,fn)=>handlers.set(type,fn)},caches,fetch:async(request,options)=>{if(offline)throw Error('Offline');calls.push(options);return new Response('{"retained":true}');}});
 async function request(){let reply;const writes=[];handlers.get('fetch')({request:{method:'GET',url,mode},respondWith:value=>reply=value,waitUntil:promise=>writes.push(promise)});const body=await (await reply).text();await Promise.all(writes);return body;}
 assert.equal(await request(),'{"retained":true}');assert(stored.has(key));if(name==='publication metadata')assert.equal(calls[0].cache,'no-store');
 offline=true;assert.equal(await request(),'{"retained":true}');
});
