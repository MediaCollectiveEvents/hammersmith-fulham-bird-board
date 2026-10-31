import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {requiredBoroughHotspots, isExcludedBoroughLocation, sanitizeBoroughFeed} from '../dist/borough-hotspots.mjs';
const raven = requiredBoroughHotspots[0];
const record = {species:'Robin', date:'2026-09-11', year:2026, month:9, hotspot:'Ravenscourt Park', checklistId:'S1'};

test('inactive Ravenscourt has one stable directory entry; aliases deduplicate without losing separate checklists',()=>{
 const feed=sanitizeBoroughFeed({hotspots:[raven,raven],records:[record,{...record,hotspotId:raven.locId,hotspot:'Renamed park'},{...record,hotspotId:raven.locId,checklistId:'S2'}]});
 assert.equal(feed.hotspots.length,1);assert.equal(feed.records.length,2);
 assert(feed.records.every(r=>r.hotspotId==='L939893'&&r.hotspot==='Ravenscourt Park'&&r.reportType==='hotspot'));
 assert.deepEqual(sanitizeBoroughFeed(feed),feed);
});

test('WWT is excluded by ID and legacy names in both hotspot and nearby/retained feeds',()=>{
 for(const location of [{locId:'L939896',name:'Renamed reserve'},{hotspot:'WWT London Wetland Centre (from 2000)'},{locName:'London Wetland Centre'}])assert(isExcludedBoroughLocation(location));
 const feed=sanitizeBoroughFeed({hotspots:[{locId:'L939896',name:'Reserve'}],records:[{...record,hotspotId:'L939896',hotspot:'Reserve'},{...record,hotspot:'WWT London Wetland Centre',reportType:'other-location'},record]});
 assert.equal(feed.records.length,1);assert.equal(feed.records[0].hotspotId,raven.locId);
});

test('real updater queries inactive Ravenscourt, rejects outside/private/invalid reports and remains idempotent',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hf-hotspot-refresh-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 for(const sub of ['scripts','dist/data'])await fs.mkdir(path.join(dir,sub),{recursive:true});
 await fs.copyFile(new URL('../scripts/update-ebird.mjs',import.meta.url),path.join(dir,'scripts/update-ebird.mjs'));
 await fs.copyFile(new URL('../dist/borough-hotspots.mjs',import.meta.url),path.join(dir,'dist/borough-hotspots.mjs'));
 await fs.writeFile(path.join(dir,'dist/data/observations.json'),JSON.stringify({records:[{...record,hotspotId:'L939896',hotspot:'Old WWT name'}]}));
 const mock=`
 import fs from 'node:fs';
 const raven=${JSON.stringify(raven)};
 const good={locId:raven.locId,locName:'Ravenscourt Park',lat:raven.lat,lng:raven.lng,obsValid:true,obsDt:'2026-10-25 10:00',comName:'Robin',sciName:'Erithacus rubecula',speciesCode:'eurrob',subId:'S100',howMany:2};
 globalThis.fetch=async input=>{
  const u=new URL(input);fs.appendFileSync(${JSON.stringify(path.join(dir,'requests'))},u.pathname+'\\n');
  let data;
  if(u.hostname==='www.planning.data.gov.uk')data={type:'Polygon',coordinates:[[[-.3,51.46],[-.18,51.46],[-.18,51.55],[-.3,51.55],[-.3,51.46]]]};
  else if(u.pathname==='/v2/ref/hotspot/geo')data=u.searchParams.has('back')?[]:[raven,{locId:'L939896',name:'WWT London Wetland Centre',lat:51.48,lng:-.23}];
  else if(u.pathname==='/v2/data/obs/geo/recent')data=[good,{...good,locId:'L939896',locName:'WWT London Wetland Centre'}, {...good,locId:'Lprivate',locationPrivate:true}];
  else if(u.pathname.endsWith('/notable'))data=[];
  else if(u.pathname==='/v2/data/obs/L939893/recent')data=[good,good,{...good,subId:'S101'},{...good,subId:'Sbad',obsValid:false},{...good,subId:'Soutside',lat:52}];
  else throw Error('Unexpected request '+u.pathname);
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 `;
 await fs.writeFile(path.join(dir,'mock.mjs'),mock);
 for(let run=0;run<2;run++){
  const result=spawnSync(process.execPath,['--import',path.join(dir,'mock.mjs'),path.join(dir,'scripts/update-ebird.mjs')],{encoding:'utf8',env:{...process.env,EBIRD_API_KEY:'fixture-only'}});
  assert.equal(result.status,0,result.stderr);
  const feed=JSON.parse(await fs.readFile(path.join(dir,'dist/data/observations.json'),'utf8'));
  assert.deepEqual(feed.hotspots,[raven]);assert.equal(feed.records.length,2);
  assert(feed.records.every(r=>r.hotspotId===raven.locId&&r.reportType==='hotspot'));
 }
 assert.match(await fs.readFile(path.join(dir,'requests'),'utf8'),/\/v2\/data\/obs\/L939893\/recent/);
});

test('published borough snapshot includes inactive Ravenscourt but no WWT reports; WWT comparison feed remains separate',async()=>{
 const feed=JSON.parse(await fs.readFile(new URL('../dist/data/observations.json',import.meta.url),'utf8'));
 assert(feed.hotspots.some(h=>h.locId===raven.locId));
 assert(feed.records.some(r=>r.hotspotId===raven.locId));
 assert(!feed.hotspots.some(isExcludedBoroughLocation));assert(!feed.records.some(isExcludedBoroughLocation));
 const wetland=JSON.parse(await fs.readFile(new URL('../dist/data/wetland-centre-observations.json',import.meta.url),'utf8'));
 assert.equal(wetland.hotspotId,'L939896');assert(wetland.records.length>0);
 const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/Object.assign\(localReports,sanitizeBoroughFeed\(d\)\)/);
});
