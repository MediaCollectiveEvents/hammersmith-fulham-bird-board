import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateRankings, verifyRelease, selectRows} from '../dist/bird-rankings-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const committed = JSON.parse(await fs.readFile(path.join(root, 'dist/data/bird-rankings.json'), 'utf8'));
const copy = () => structuredClone(committed);
const run = (script, args, env = process.env) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {env, encoding:'utf8'});
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bird-rankings-test-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  const archive = path.join(dir, 'archive.csv'), publicLayer = path.join(dir, 'public.csv'), seasonality = path.join(dir, 'seasonality'), output = path.join(dir, 'rankings.json');
  const rows = [
    ...['2020-01-01','2025-09-28','2025-09-29','2026-09-28'].map(d => ['Alpha', 'Alpha avis', d]),
    ...['2020-02-01','2021-02-01','2022-02-01','2023-02-01','2026-05-01'].map(d => ['Beta', 'Beta avis', d]),
    ['Hybrid (hybrid)', 'Alpha x Beta', '2020-01-02'], ['Excluded / taxon', 'Excluded', '2020-01-01']
  ];
  const csv = 'COMMON NAME,SCIENTIFIC NAME,OBSERVATION DATE,GLOBAL UNIQUE IDENTIFIER,APPROVED,OBSERVER ID,LOCALITY,LATITUDE,SAMPLING EVENT IDENTIFIER\n'
    + rows.map((r, i) => [...r, `ROW${i}`, '1', 'PRIVATE_OBSERVER', 'PRIVATE_LOCATION', '51.123456', 'PRIVATE_CHECKLIST'].join(',')).join('\n') + '\n';
  await fs.writeFile(archive, csv);
  await fs.writeFile(publicLayer, 'COMMON NAME,records,first_record,last_record,borough_rank,primary_category\nBeta,5,2020-02-01,2026-05-01,1,General Species\nAlpha,4,2020-01-01,2026-09-28,2,General Species\nHybrid (hybrid),1,2020-01-02,2020-01-02,3,Borough Mega\n');
  const built = run('build-seasonality.mjs', [archive, publicLayer], {...process.env, SEASONALITY_OUTPUT_DIR:seasonality});
  assert.equal(built.status, 0, built.stderr);
  return {dir, archive, publicLayer, seasonality, output, csv, build:() => run('build-bird-rankings.mjs', [archive, publicLayer, seasonality, output])};
}

test('committed rankings reconcile with the existing public history and calendar', async () => {
  const d = validateRankings(committed);
  const history = JSON.parse(await fs.readFile(path.join(root, 'dist/data/ebird-history.json'), 'utf8'));
  assert.equal(d.coverage.taxonCount, history.taxonCount);
  assert.equal(d.coverage.recordCount, history.recordCount);
  const taxa = new Map(d.rankings.borough.map(r => [r.commonName, r]));
  for (const r of history.species) {
    assert.equal(taxa.get(r.commonName).records, r.records);
    assert.equal(taxa.get(r.commonName).scientificName, r.scientificName);
    assert.equal(taxa.get(r.commonName).lastRecorded, r.lastRecorded);
  }
  await verifyRelease(d, await fs.readFile(path.join(root, 'dist/data/seasonality_metadata.json'), 'utf8'), await fs.readFile(path.join(root, 'dist/data/species_migration_calendar.csv'), 'utf8'));
  assert.equal(d.coverage.taxonCount, 133);
  assert.equal(d.coverage.recordCount, 30288);
  assert.equal(d.rankings.recent.reduce((sum, r) => sum + r.records, 0), 3496);
  assert.equal(d.rankings.recent.filter(r => !r.records).length, 44);
});
test('borough descends and least-recorded ascends, using deterministic alphabetical tie-breaks', () => {
  const d = validateRankings(committed);
  assert.equal(d.rankings.borough[0].commonName, 'Rock Pigeon');
  assert.equal(d.rankings.borough[0].records, 1675);
  assert.equal(d.rankings.leastRecorded[0].commonName, 'Bohemian Waxwing');
  for (const rows of [d.rankings.borough, d.rankings.leastRecorded]) {
    for (let i=1; i<rows.length; i++) if (rows[i-1].records===rows[i].records) assert.ok(rows[i-1].commonName < rows[i].commonName);
  }
});
test('all five views retain the complete taxon universe including hybrids', () => {
  const expected = committed.rankings.borough.map(r => r.commonName).sort();
  assert.equal(expected.filter(n => n.includes('(hybrid)')).length, 2);
  for (const view of ['borough','recent','rising','leastRecorded','seasonal']) {
    assert.deepEqual(selectRows(committed, {view}).map(r => r.commonName).sort(), expected);
  }
});
test('rolling window includes both boundary days and excludes the preceding day', async t => {
  const f = await fixture(t);
  assert.equal(f.build().status, 0);
  const d = JSON.parse(await fs.readFile(f.output, 'utf8'));
  assert.deepEqual(d.recentWindow, {start:'2025-09-29',end:'2026-09-28',days:365});
  const alpha = d.rankings.recent.find(r => r.commonName === 'Alpha');
  const beta = d.rankings.recent.find(r => r.commonName === 'Beta');
  const hybrid = d.rankings.recent.find(r => r.commonName.includes('hybrid'));
  assert.equal(alpha.records, 2); assert.equal(alpha.recentRank, 1); assert.equal(alpha.rankChange, 1);
  assert.equal(beta.rankChange, -1);
  assert.equal(hybrid.records, 0); assert.equal(hybrid.recentRank, null); assert.equal(hybrid.rankChange, null);
  assert.equal(d.rankings.seasonal['9'].find(r => r.commonName === 'Alpha').records, 3);
  assert.equal(d.rankings.seasonal['9'].find(r => r.commonName === 'Alpha').yearsWithRecords, 2);
});
test('repeat builds are byte-identical and changing raw row order does not change counts/ranks', async t => {
  const f = await fixture(t);
  assert.equal(f.build().status, 0); const before = await fs.readFile(f.output, 'utf8');
  assert.equal(f.build().status, 0); assert.equal(await fs.readFile(f.output, 'utf8'), before);
  const lines = f.csv.trimEnd().split('\n');
  await fs.writeFile(f.archive, lines[0]+'\n'+lines.slice(1).reverse().join('\n')+'\n');
  assert.equal(f.build().status, 0);
  const first = JSON.parse(before), second = JSON.parse(await fs.readFile(f.output, 'utf8'));
  assert.deepEqual(first.rankings, second.rankings);
  assert.notEqual(first.fingerprints.archive, second.fingerprints.archive);
});
test('new public output has no observation/person/location fields or values', async t => {
  const f = await fixture(t); assert.equal(f.build().status, 0);
  const bytes = await fs.readFile(f.output, 'utf8');
  for (const secret of ['PRIVATE_OBSERVER','PRIVATE_LOCATION','PRIVATE_CHECKLIST','51.123456','ROW0']) assert.ok(!bytes.includes(secret));
  assert.doesNotMatch(bytes, /"(?:observer|checklistId|hotspotId|coordinates|latitude|longitude|locality|locId)"/i);
});
for (const [name, mutate] of [
  ['missing identity', s => s.replace('ROW0,1', ',1')],
  ['duplicate identity', s => s.replace('ROW1,1', 'ROW0,1')],
  ['missing scientific name', s => s.replace('Alpha,Alpha avis,', 'Alpha,,')],
  ['malformed date', s => s.replace('2025-09-29','2025-02-30')],
  ['unapproved record', s => s.replace('ROW0,1','ROW0,0')],
  ['empty archive', s => s.split('\n')[0]+'\n']
]) test(`invalid source (${name}) preserves last good output`, async t => {
  const f = await fixture(t); assert.equal(f.build().status, 0);
  const before = await fs.readFile(f.output, 'utf8');
  await fs.writeFile(f.archive, mutate(f.csv)); assert.notEqual(f.build().status, 0);
  assert.equal(await fs.readFile(f.output, 'utf8'), before);
});
test('blank/duplicate public names and changed public counts fail safely', async t => {
  const f = await fixture(t); const source = await fs.readFile(f.publicLayer,'utf8');
  for (const broken of [source.replace('Beta,5',',5'),source+'Alpha,4,2020-01-01,2026-09-28,2,General Species\n',source.replace('Beta,5','Beta,6')]) {
    await fs.writeFile(f.publicLayer, broken); assert.notEqual(f.build().status, 0);
  }
  await assert.rejects(fs.access(f.output));
});
test('source paths cannot be overwritten and failed metadata preserves existing rankings', async t => {
  const f=await fixture(t); assert.equal(f.build().status,0);
  const before=await fs.readFile(f.output,'utf8');
  const metadataPath=path.join(f.seasonality,'seasonality_metadata.json');
  const original=await fs.readFile(metadataPath,'utf8');
  assert.notEqual(run('build-bird-rankings.mjs',[f.archive,f.publicLayer,f.seasonality,metadataPath]).status,0);
  assert.equal(await fs.readFile(metadataPath,'utf8'),original);
  await fs.writeFile(metadataPath,JSON.stringify({...JSON.parse(original),expected_board_status:'FAILED'}));
  assert.notEqual(f.build().status,0);assert.equal(await fs.readFile(f.output,'utf8'),before);
});
for (const [name, mutate] of [
  ['unknown private field', d => {d.rankings.borough[0].observer = 'DO_NOT_PUBLISH';}],
  ['missing field', d => {delete d.rankings.borough[0].scientificName;}],
  ['duplicate name', d => {d.rankings.borough[1].commonName = d.rankings.borough[0].commonName;}],
  ['unexpected name', d => {d.rankings.recent[0].commonName = 'Unknown';}],
  ['empty universe', d => {d.rankings.borough = [];}],
  ['count mismatch', d => {d.coverage.recordCount++;}],
  ['bad window', d => {d.recentWindow.start='2025-09-28';}],
  ['monthly mismatch', d => {d.rankings.seasonal['1'][0].records++;}],
  ['bad rising delta', d => {d.rankings.rising[0].rankChange++;}],
  ['invalid date', d => {d.rankings.borough[0].firstRecorded='2020-02-30';}],
  ['unverified hotspot', d => {d.rankings.hotspots=[{name:'Unapproved'}];}]
]) test(`aggregate validator rejects ${name}`, () => {const d=copy();mutate(d);assert.throws(()=>validateRankings(d));});
test('READY fingerprint gate rejects FAILED, INCOMPLETE, missing metadata and mismatched calendar', async () => {
  const meta = await fs.readFile(path.join(root,'dist/data/seasonality_metadata.json'),'utf8');
  const cal = await fs.readFile(path.join(root,'dist/data/species_migration_calendar.csv'),'utf8');
  for (const expected_board_status of ['FAILED','INCOMPLETE']) await assert.rejects(verifyRelease(committed,JSON.stringify({...JSON.parse(meta),expected_board_status}),cal));
  await assert.rejects(verifyRelease(committed,'{}',cal));
  await assert.rejects(verifyRelease(committed,meta,cal+'\n'));
});
test('historical release integration validates an isolated bundle and never overwrites an existing release', async t => {
  const f=await fixture(t), output=path.join(f.dir,'release');
  const args=[f.archive,f.publicLayer,f.seasonality,output];
  const result=run('build-archive-boards.mjs',args);assert.equal(result.status,0,result.stderr);
  await fs.access(path.join(output,'READY'));
  assert.equal(JSON.parse(await fs.readFile(path.join(output,'ebird-history.json'),'utf8')).recordCount,10);
  const prior=await fs.readFile(path.join(output,'bird-rankings.json'),'utf8');
  assert.notEqual(run('build-archive-boards.mjs',args).status,0);
  assert.equal(await fs.readFile(path.join(output,'bird-rankings.json'),'utf8'),prior);
  const badOutput=path.join(f.dir,'failed');
  await fs.writeFile(f.archive, f.csv.replace('ROW0,1','ROW0,0'));
  assert.notEqual(run('build-archive-boards.mjs',[f.archive,f.publicLayer,f.seasonality,badOutput]).status,0);
  await assert.rejects(fs.access(badOutput));
  assert.ok(!(await fs.readdir(f.dir)).some(x=>x.startsWith('.rankings-candidate-')));
});
test('search, sorting, month selection and empty states retain canonical ranks', () => {
  assert.ok(selectRows(committed,{search:'columba livia'}).some(r=>r.commonName==='Rock Pigeon'));
  assert.equal(selectRows(committed,{search:'NOT A REAL TAXON'}).length,0);
  assert.deepEqual(selectRows(committed,{sort:'name'}).map(r=>r.commonName),committed.rankings.borough.map(r=>r.commonName).sort());
  assert.deepEqual(selectRows(committed,{view:'seasonal',month:9}).map(r=>[r.commonName,r.records]),committed.rankings.seasonal['9'].map(r=>[r.commonName,r.records]));
  assert.throws(()=>selectRows(committed,{month:13}));
});
test('UI is isolated, semantic, keyboard accessible and contains no raw-feed integration', async () => {
  const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
  const ui=await fs.readFile(path.join(root,'dist/bird-rankings.mjs'),'utf8');
  const css=await fs.readFile(path.join(root,'dist/bird-rankings.css'),'utf8');
  assert.match(html,/data-category="historic"[^>]+data-open-panel="panel-rankings"/);
  assert.match(html,/<table[^>]+aria-describedby="rankings-caption rankings-explanation"/);
  assert.match(html,/tabindex="0" role="region" aria-label="Scrollable bird rankings table"/);
  assert.match(html,/id="rankings-page-status" role="status" aria-live="polite"/);
  assert.match(ui,/validateRankings/);assert.match(ui,/verifyRelease/);
  assert.match(ui,/No taxa match/);assert.match(ui,/Small samples/);
  assert.doesNotMatch(ui,/observations\.json|api\.ebird|observer|checklistId/);
  assert.match(css,/overflow-x:auto/);assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/:focus-visible/);
});
