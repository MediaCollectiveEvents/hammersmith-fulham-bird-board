import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const importer=new URL('../scripts/import-ebird-history.py',import.meta.url).pathname;

test('eBird history exporter validates dates/counts and publishes only species aggregates',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ebird-history-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const publicFile=path.join(dir,'public.csv'),archive=path.join(dir,'archive.csv'),out=path.join(dir,'out.json');
 const publicCsv='COMMON NAME,records,first_record,last_record\nTest Bird,2,2020-01-01,2026-09-28\n';
 await fs.writeFile(publicFile,publicCsv);
 await fs.writeFile(archive,'COMMON NAME,SCIENTIFIC NAME,OBSERVATION DATE,OBSERVER ID,LATITUDE\nTest Bird,Testus avis,2020-01-01,PRIVATE_OBSERVER,51.49\nTest Bird,Testus avis,2026-09-28,PRIVATE_OBSERVER,51.49\n');
 const run=()=>spawnSync('python3',[importer,publicFile,archive,out],{encoding:'utf8'});
 assert.equal(run().status,0);const bytes=await fs.readFile(out,'utf8'),data=JSON.parse(bytes);
 assert.equal(data.species[0].lastRecorded,'2026-09-28');assert.equal(data.recordCount,2);
 assert.deepEqual(Object.keys(data.species[0]).sort(),['commonName','lastRecorded','records','scientificName']);assert.ok(!bytes.includes('PRIVATE_OBSERVER'));assert.ok(!bytes.includes('51.49'));
 const good=bytes;
 assert.equal(run().status,0);assert.equal(await fs.readFile(out,'utf8'),good);
 await fs.writeFile(publicFile,publicCsv.replace('Test Bird,2','Test Bird,3'));assert.notEqual(run().status,0);assert.equal(await fs.readFile(out,'utf8'),good);
 await fs.writeFile(publicFile,publicCsv+'Test Bird,2,2020-01-01,2026-09-28\n');assert.notEqual(run().status,0);
});
test('published eBird history contains 133 valid unique public-layer entries and no record-level fields',async()=>{
 const data=JSON.parse(await fs.readFile(new URL('dist/data/ebird-history.json',root),'utf8'));
 assert.equal(data.species.length,133);assert.equal(new Set(data.species.map(r=>r.commonName)).size,133);
 assert.equal(data.recordCount,data.species.reduce((n,r)=>n+r.records,0));
 for(const r of data.species){assert.match(r.lastRecorded,/^\d{4}-\d{2}-\d{2}$/);assert.ok(r.scientificName);assert.ok(r.records>0);assert.deepEqual(Object.keys(r).sort(),['commonName','lastRecorded','records','scientificName']);}
});
test('recorded-species UI uses eBird archive and renders a dated last-recorded column',async()=>{
 const html=await fs.readFile(new URL('dist/index.html',root),'utf8');
 assert.match(html,/fetch\('\.\/data\/ebird-history\.json'/);assert.doesNotMatch(html,/fetch\('\.\/data\/nbn-history\.json'/);
 assert.match(html,/<span>Last recorded<\/span>/);assert.match(html,/item\.lastRecorded/);assert.match(html,/not updated by the recent-sightings API feed/);
 for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
});
