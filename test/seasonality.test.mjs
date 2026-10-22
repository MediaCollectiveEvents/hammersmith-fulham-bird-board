import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(root, 'scripts/build-seasonality.mjs');
const validateScript = path.join(root, 'scripts/validate-seasonality.mjs');

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'seasonality-test-'));
  const archive = path.join(directory, 'archive.csv');
  const publicLayer = path.join(directory, 'birds_hf_public.csv');
  const outputDir = path.join(directory, 'dist/data');
  const archiveRows = ['COMMON NAME,OBSERVATION DATE,GLOBAL UNIQUE IDENTIFIER'];
  let id = 0;
  for (const year of [2022, 2023, 2024]) {
    for (let month = 1; month <= 12; month++) {
      archiveRows.push(`Test Bird,${year}-${String(month).padStart(2, '0')}-15,test-${++id}`);
    }
  }
  await fs.writeFile(archive, `${archiveRows.join('\n')}\n`);
  await fs.writeFile(publicLayer, 'COMMON NAME\nTest Bird\n');
  return {directory, archive, publicLayer, outputDir};
}

function runBuild({archive, publicLayer, outputDir}) {
  return spawnSync(process.execPath, [buildScript, archive, publicLayer], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, SEASONALITY_OUTPUT_DIR: outputDir}
  });
}

test('build emits six validated outputs and a READY metadata record', async t => {
  const paths = await fixture();
  t.after(() => fs.rm(paths.directory, {recursive: true, force: true}));

  const result = runBuild(paths);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const expectedFiles = [
    'species_migration_calendar.csv',
    'seasonality_validation.csv',
    'seasonality_audit.csv',
    'seasonality_changes.csv',
    'seasonality_metadata.json',
    'seasonality_metadata.csv'
  ];
  for (const filename of expectedFiles) {
    const stat = await fs.stat(path.join(paths.outputDir, filename));
    assert.ok(stat.size > 0, `${filename} should be non-empty`);
  }

  const metadata = JSON.parse(await fs.readFile(path.join(paths.outputDir, 'seasonality_metadata.json'), 'utf8'));
  const schema = JSON.parse(await fs.readFile(path.join(root, 'schemas/seasonality_metadata.schema.json'), 'utf8'));
  for (const field of schema.required) assert.ok(field in metadata, `metadata should contain ${field}`);
  assert.equal(metadata.expected_board_status, 'READY');
  assert.equal(metadata.validation_passed, true);
  assert.equal(metadata.reconciliation_passed, true);
  assert.equal(metadata.public_species_count, 1);
  assert.equal(metadata.calendar_species_count, 1);
  assert.equal(metadata.changes_detected, 0);

  const summary = (await fs.readFile(path.join(paths.outputDir, 'seasonality_validation.csv'), 'utf8')).trim().split('\n');
  assert.match(summary[0], /expected_board_status/);
  assert.match(summary[0], /issues/);
  assert.match(summary[1], /READY/);
});

test('early build failure leaves an INCOMPLETE board status', async t => {
  const paths = await fixture();
  t.after(() => fs.rm(paths.directory, {recursive: true, force: true}));

  const result = runBuild({...paths, archive: path.join(paths.directory, 'missing.csv')});
  assert.notEqual(result.status, 0);

  const metadata = JSON.parse(await fs.readFile(path.join(paths.outputDir, 'seasonality_metadata.json'), 'utf8'));
  assert.equal(metadata.expected_board_status, 'INCOMPLETE');
  assert.equal(metadata.validation_passed, false);
});

test('validator rejects metadata that violates the JSON Schema', async t => {
  const paths = await fixture();
  t.after(() => fs.rm(paths.directory, {recursive: true, force: true}));

  const build = runBuild(paths);
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const metadataPath = path.join(paths.outputDir, 'seasonality_metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  metadata.public_species_count = '1';
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  const validation = spawnSync(process.execPath, [validateScript, paths.publicLayer], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, SEASONALITY_OUTPUT_DIR: paths.outputDir}
  });
  assert.notEqual(validation.status, 0);
  assert.match(validation.stderr, /Metadata schema \/public_species_count: must be integer/);
});
