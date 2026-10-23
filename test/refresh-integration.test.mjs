import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const script=path.join(root,'upstream/refresh.sh');
// These doubles test shell orchestration and gating, not the seasonality rules.
for(const mode of ['READY','missing-public','generation-failure','validation-failure','missing-metadata','FAILED','INCOMPLETE','missing-calendar']) {
 test('isolated refresh orchestration: '+mode,async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'refresh-integration-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const upstream=path.join(dir,'upstream'),board=path.join(dir,'board'),builds=path.join(dir,'builds'),bin=path.join(dir,'bin');
  for(const p of [upstream,builds,bin,path.join(board,'scripts'),path.join(board,'dist/data')])await fs.mkdir(p,{recursive:true});
  await fs.writeFile(path.join(upstream,'birds.db'),'unchanged database');
  await fs.writeFile(path.join(upstream,'rebuild_public_layer.sql'),"COPY (SELECT 1) TO '/Users/cdparry/Desktop/birds_hf_public.csv';\n");
  await fs.writeFile(path.join(board,'scripts/build-seasonality.mjs'),'test double');
  for(const f of ['species_migration_calendar.csv','seasonality_changes.csv'])await fs.writeFile(path.join(board,'dist/data',f),'unchanged production');
  const archive=path.join(dir,'archive.csv');await fs.writeFile(archive,'private archive');
  await fs.writeFile(path.join(bin,'duckdb'),`#!/bin/bash\ncat > /dev/null\nif [ "$TEST_MODE" != missing-public ]; then echo 'COMMON NAME' > "$REFRESH_RUN/birds_hf_public.csv"; fi\n`,{mode:0o700});
  await fs.writeFile(path.join(bin,'npm'),`#!/usr/bin/env node
const fs=require('fs'),p=require('path'),m=process.env.TEST_MODE,d=process.env.SEASONALITY_OUTPUT_DIR;
const stage=process.argv.includes('build:seasonality')?'build':'validate';
fs.appendFileSync(p.join(process.env.BUILD_ROOT,'calls'),stage+'\\n');
if(stage==='build'){
 if(m==='generation-failure')process.exit(9);
 for(const f of ['species_migration_calendar.csv','seasonality_validation.csv','seasonality_audit.csv','seasonality_changes.csv','seasonality_metadata.csv'])fs.writeFileSync(p.join(d,f),'fixture');
 fs.writeFileSync(p.join(d,'seasonality_metadata.json'),JSON.stringify({validation_passed:true,reconciliation_passed:true,expected_board_status:m==='FAILED'||m==='INCOMPLETE'?m:'READY'}));
 if(m==='missing-metadata')fs.unlinkSync(p.join(d,'seasonality_metadata.json'));
 if(m==='missing-calendar')fs.unlinkSync(p.join(d,'species_migration_calendar.csv'));
}
if(stage==='validate'&&m==='validation-failure')process.exit(8);
`,{mode:0o700});
  const result=spawnSync('bash',[script],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,UPSTREAM_DIR:upstream,ARCHIVE:archive,BOARD_DIR:board,BUILD_ROOT:builds,TEST_MODE:mode}});
  assert.equal(result.status===0,mode==='READY',result.stderr);
  const runs=(await fs.readdir(builds)).filter(x=>x.startsWith('refresh.'));
  assert.equal(runs.length,mode==='READY'?1:0);
  if(mode==='READY'){
   await fs.access(path.join(builds,runs[0],'READY'));
   assert.equal(await fs.readFile(path.join(builds,'calls'),'utf8'),'build\nvalidate\n');
  }
  assert.equal(await fs.readFile(path.join(upstream,'birds.db'),'utf8'),'unchanged database');
  for(const f of ['species_migration_calendar.csv','seasonality_changes.csv'])assert.equal(await fs.readFile(path.join(board,'dist/data',f),'utf8'),'unchanged production');
 });
}
