import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {buildMonthlyArchives,archiveSightings} from '../scripts/archive-sightings.mjs';
import {londonMonth,validObservationDate,observationKey,monthlyTotals} from '../dist/sightings-months.mjs';
const row=(date='2026-09-30',extra={})=>({species:'Robin',latin:'Erithacus rubecula',date,year:Number(date.slice(0,4)),month:Number(date.slice(5,7)),hotspot:'Ravenscourt Park',hotspotId:'L939893',checklistId:'S1',reportType:'hotspot',observer:'Do not republish',...extra});
const feed=(records,updatedAt='2026-10-31T10:00:00Z')=>({source:'eBird',updatedAt,hotspots:[],records});

test('London month-end, year rollover and DST use civil months rather than host/UTC boundaries',()=>{
 assert.equal(londonMonth(new Date('2026-06-30T23:30:00Z')),'2026-07');
 assert.equal(londonMonth(new Date('2027-01-01T00:00:00Z'),-1),'2026-12');
 assert.equal(londonMonth(new Date('2024-03-01T00:01:00Z'),-1),'2024-02');
 assert.equal(validObservationDate('2024-02-29'),true);assert.equal(validObservationDate('2023-02-29'),false);
});

test('partition by observation date, preserve exact identity, whitelist personal fields and reconcile totals',()=>{
 const source=feed([row(),row(),row('2026-10-01'),row('2026-09-30',{checklistId:'S2'})]);const before=JSON.stringify(source);
 const months=buildMonthlyArchives(source);
 assert.deepEqual([...months.keys()],['2026-09','2026-10']);assert.equal(months.get('2026-09').records.length,2);
 assert.equal(observationKey(months.get('2026-09').records[0]),observationKey(row()));
 assert(!JSON.stringify([...months]).includes('Do not republish'));assert(!Object.hasOwn(months.get('2026-09').records[0],'observer'));
 assert.deepEqual(monthlyTotals(months.get('2026-09').records),{reports:2,species:1,hotspots:1,lastRecorded:'2026-09-30'});
 assert.equal(months.get('2026-09').coverage.status,'partial');assert.equal(JSON.stringify(source),before);
});

test('repeat daily refreshes and reordered API rows produce byte-identical archives, including metadata',()=>{
 const source=feed([row(),row('2026-10-01')]);const first=buildMonthlyArchives(source);
 assert.deepEqual(buildMonthlyArchives(feed([...source.records].reverse(),'2026-11-01T10:00:00Z'),first),first);
});

test('late previous-month rows merge additively; fewer/empty responses preserve already collected records',()=>{
 const first=buildMonthlyArchives(feed([row()]));
 const second=buildMonthlyArchives(feed([row('2026-09-29',{checklistId:'S2'})]),first);
 assert.equal(second.get('2026-09').records.length,2);
 assert.deepEqual(buildMonthlyArchives(feed([]),second),second);
 assert.equal(buildMonthlyArchives(feed([])).size,0,'missing months must not become invented zero-report months');
});

test('same-key corrections replace fields; changed dates keep prior identity exactly as the existing updater does',()=>{
 const first=buildMonthlyArchives(feed([row()]));
 const next=buildMonthlyArchives(feed([row(undefined,{howMany:7}),row('2026-09-29')]),first);
 assert.equal(next.get('2026-09').records.length,2);
 assert.equal(next.get('2026-09').records.find(r=>r.date==='2026-09-30').howMany,7);
});

test('WWT and Kensal exclusions apply to old and incoming archives; Ravenscourt remains',()=>{
 const records=[row(),row(undefined,{hotspotId:'L939896'}),row(undefined,{hotspotId:'legacy',hotspot:'WWT London Wetland Centre'}),row(undefined,{hotspotId:'L12107155'})];
 const result=buildMonthlyArchives(feed(records));assert.equal(result.get('2026-09').records.length,1);
 assert(result.get('2026-09').hotspots.some(h=>h.locId==='L939893'));
});

test('calendar validation handles leap years and rejects inconsistent stored month fields',()=>{
 assert(buildMonthlyArchives(feed([row('2024-02-29')])).has('2024-02'));
 for(const r of [row('2023-02-29'),row('2026-09-30',{month:10})])assert.throws(()=>buildMonthlyArchives(feed([r])),/Invalid validated/);
});

test('disk generation preserves old months across deployments, skips unchanged writes and fails before touching good files',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hf-monthly-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const feedPath=path.join(root,'observations.json'),directory=path.join(root,'archive');
 await fs.writeFile(feedPath,JSON.stringify(feed([row()])));await archiveSightings({feedPath,directory});
 const month=path.join(directory,'2026-09.json'),before=await fs.readFile(month,'utf8');
 assert.equal((await archiveSightings({feedPath,directory})).changed,0);
 await fs.writeFile(feedPath,JSON.stringify(feed([row('2026-10-01')])));await archiveSightings({feedPath,directory});
 assert.equal(await fs.readFile(month,'utf8'),before);
 await fs.writeFile(feedPath,JSON.stringify(feed([row('2026-02-30')])));await assert.rejects(archiveSightings({feedPath,directory}));
 assert.equal(await fs.readFile(month,'utf8'),before);
 await fs.writeFile(feedPath,'not JSON');await assert.rejects(archiveSightings({feedPath,directory}));assert.equal(await fs.readFile(month,'utf8'),before);
});

test('workflow archives successful borough refreshes and delegates dist publication without changing other feed commands',async()=>{
 const workflow=await fs.readFile(new URL('../.github/workflows/update-ebird.yml',import.meta.url),'utf8');
 assert.match(workflow,/if: steps.borough.outcome == 'success'/);assert.match(workflow,/git add .*dist\/data\/sightings-archive/);
 const pages=await fs.readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(pages,/path: dist/);assert.doesNotMatch(workflow,/deploy-pages/);assert.match(workflow,/run: npm run update:wetland/);assert.match(workflow,/run: npm run update:birdweather/);
 const manifest=JSON.parse(await fs.readFile(new URL('../dist/data/sightings-archive/index.json',import.meta.url)));
 assert(manifest.months.some(m=>m.month==='2026-09'));
 for(const month of manifest.months){const archive=JSON.parse(await fs.readFile(new URL(`../dist/data/sightings-archive/${month.month}.json`,import.meta.url)));assert.deepEqual(monthlyTotals(archive.records),archive.totals);assert.equal(month.reports,archive.records.length);assert(archive.records.every(r=>!Object.hasOwn(r,'observer')));}
});
