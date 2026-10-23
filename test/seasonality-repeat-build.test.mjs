import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;

async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seasonality-repeat-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const archive=path.join(dir,'archive.csv'),publicFile=path.join(dir,'public.csv'),out=path.join(dir,'out');
 await fs.writeFile(publicFile,'COMMON NAME\nSeasonal Bird\n');
 async function writeArchive(arrival=4){
  const rows=['COMMON NAME,OBSERVATION DATE,APPROVED,GLOBAL UNIQUE IDENTIFIER'];let id=0;
  for(let year=2010;year<=2020;year++)for(let month=arrival;month<=9;month++)rows.push(`Seasonal Bird,${year}-${String(month).padStart(2,'0')}-15,1,repeat-${++id}`);
  await fs.writeFile(archive,rows.join('\n')+'\n');
 }
 const read=name=>fs.readFile(path.join(out,name),'utf8');
 async function build(){
  const r=spawnSync(process.execPath,[path.join(root,'scripts/build-seasonality.mjs'),archive,publicFile],{encoding:'utf8',env:{...process.env,SEASONALITY_OUTPUT_DIR:out}});
  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
  const meta=JSON.parse(await read('seasonality_metadata.json'));assert.equal(meta.expected_board_status,'READY');
  return (await read('seasonality_changes.csv')).trim().split('\n').slice(1);
 }
 await writeArchive();await build();return {writeArchive,read,build};
}
test('identical archive rebuilt twice emits zero new changes',async t=>{
 const f=await fixture(t),before=await f.read('species_migration_calendar.csv');
 assert.deepEqual(await f.build(),[]);assert.equal(await f.read('species_migration_calendar.csv'),before);
});
test('unchanged numeric months round-trip through CSV without change rows',async t=>{
 const f=await fixture(t);const table=await f.read('species_migration_calendar.csv');
 const [headers,line]=table.trim().split('\n').map(r=>r.split(','));
 assert.equal(line[headers.indexOf('arrival_month')],'4');assert.equal(line[headers.indexOf('departure_month')],'9');
 assert.deepEqual(await f.build(),[]);
});
test('actual month change is reported and preserved without new rows on replay',async t=>{
 const f=await fixture(t);await f.writeArchive(5);const changes=await f.build();
 assert.equal(changes.length,1);assert.match(changes[0],/^Seasonal Bird,arrival_month,4,5,/);
 assert.deepEqual(await f.build(),changes);
});
for(const field of ['confidence','movement_type'])test('unchanged '+field+' emits no change',async t=>{
 const f=await fixture(t);const before=await f.read('species_migration_calendar.csv');
 const [headers,line]=before.trim().split('\n').map(r=>r.split(','));assert.ok(line[headers.indexOf(field)]);
 assert.deepEqual(await f.build(),[]);assert.equal(await f.read('species_migration_calendar.csv'),before);
});
