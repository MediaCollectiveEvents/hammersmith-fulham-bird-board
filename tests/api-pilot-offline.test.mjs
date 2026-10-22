import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Exercise the real updater without modifying it or allowing real network calls.
const updater = await readFile(new URL('../scripts/update-ebird.mjs', import.meta.url), 'utf8');
const seed = {source:'eBird', updatedAt:'2026-10-01T00:00:00Z', records:[{
  species:'Robin', latin:'Erithacus rubecula', speciesCode:'eurrob1',
  year:2026, month:10, date:'2026-10-10', notable:false, reportType:'hotspot',
  hotspot:'Synthetic fixture location', hotspotId:'LTEST', checklistId:'STEST',
  observer:null, howMany:1
}]};
const observation = {comName:'Robin', sciName:'Erithacus rubecula', speciesCode:'eurrob1',
  obsDt:'2026-10-10 09:00', locId:'LTEST', locName:'Synthetic fixture location',
  lat:51.49, lng:-0.23, subId:'STEST', obsValid:true, howMany:1};

async function run(t, scenario) {
  const root = await mkdtemp(path.join(tmpdir(), 'hf-offline-pilot-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'scripts'));
  await mkdir(path.join(root,'dist/data'),{recursive:true});
  await writeFile(path.join(root,'scripts/update-ebird.mjs'),updater);
  const before=JSON.stringify(seed,null,2)+'\n';
  const output=path.join(root,'dist/data/observations.json');
  await writeFile(output,before);
  const records = scenario==='deleted' ? [] : scenario==='duplicate' ? [observation, observation]
    : [{...observation, ...(scenario==='correction' ? {howMany:7} : scenario==='date-correction' ? {obsDt:'2026-10-11 09:00'} : {})}];
  const mock=`
const records=${JSON.stringify(records)};
let limited=false;
globalThis.fetch=async function(input) {
 const u=new URL(String(input));
 if (u.href==='https://www.planning.data.gov.uk/entity/8600296.geojson') return new Response(JSON.stringify({type:'Polygon',coordinates:[[[-0.4,51.4],[0,51.4],[0,51.6],[-0.4,51.6],[-0.4,51.4]]]}));
 if (u.origin!=='https://api.ebird.org') throw new Error('Unexpected URL blocked by offline harness');
 if (${JSON.stringify(scenario)}==='failure') throw new Error('Synthetic network failure');
 if (${JSON.stringify(scenario)}==='rate-limit' && !limited) {limited=true; return new Response('Synthetic rate limit',{status:429,headers:{'retry-after':'0.001'}});}
 if (u.pathname==='/v2/ref/hotspot/geo') return new Response(JSON.stringify([{locId:'LTEST',locName:'Synthetic fixture location',lat:51.49,lng:-0.23}]));
 if (u.pathname==='/v2/data/obs/geo/recent' || u.pathname.endsWith('/notable')) return new Response('[]');
 if (u.pathname==='/v2/data/obs/LTEST/recent') return new Response(JSON.stringify(records));
 throw new Error('Unrecognised endpoint blocked by offline harness');
};`;
  const preload=path.join(root,'mock.mjs');
  await writeFile(preload,mock);
  // Deliberately do not inherit EBIRD_API_KEY or any other user environment secrets.
  const result=spawnSync(process.execPath,['--import',preload,path.join(root,'scripts/update-ebird.mjs')],{
    env:{EBIRD_API_KEY:'synthetic-offline-token'},encoding:'utf8',timeout:15000
  });
  assert.ifError(result.error);
  const after=await readFile(output,'utf8');
  return {result,before,after,feed:JSON.parse(after)};
}

test('duplicate API rows produce one retained key',async t=>{
 const r=await run(t,'duplicate');assert.equal(r.result.status,0);assert.equal(r.feed.records.length,1);
 assert.equal(r.feed.lastRunNewReports,2); // Accepted-row count is not unique additions.
});
test('same-key correction replaces fields',async t=>{
 const r=await run(t,'correction');assert.equal(r.result.status,0);assert.equal(r.feed.records.length,1);assert.equal(r.feed.records[0].howMany,7);
});
test('date correction exposes stale old-key retention',async t=>{
 const r=await run(t,'date-correction');assert.equal(r.result.status,0);
 assert.deepEqual(r.feed.records.map(x=>x.date),['2026-10-10','2026-10-11']);
});
test('missing or deleted API row is retained, not reconciled away',async t=>{
 const r=await run(t,'deleted');assert.equal(r.result.status,0);assert.deepEqual(r.feed.records,seed.records);
});
test('request failure leaves previous output byte-identical',async t=>{
 const r=await run(t,'failure');assert.notEqual(r.result.status,0);assert.equal(r.after,r.before);assert.match(r.result.stderr,/Synthetic network failure/);
});
test('429 retry completes without duplicate output',async t=>{
 const r=await run(t,'rate-limit');assert.equal(r.result.status,0);assert.equal(r.feed.records.length,1);assert.match(r.result.stderr,/rate limit; retrying/);
});
