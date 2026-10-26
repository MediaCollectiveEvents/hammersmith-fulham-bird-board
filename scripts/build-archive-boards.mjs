// Downstream of the managed refresh's private READY bundle. Never publishes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [archive, publicLayer, seasonality, output] = process.argv.slice(2);
if (!archive || !publicLayer || !seasonality || !output || process.argv.length !== 6) throw Error('Usage: build-archive-boards.mjs <archive.csv> <public.csv> <READY-seasonality-dir> <new-private-release-dir>');
const target = path.resolve(output);
if (target === root || target.startsWith(root + path.sep)) throw Error('Release candidates must be outside the board repository');
try { await fs.lstat(target); throw Error('Output already exists; preserve the last known-good release'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await fs.mkdir(path.dirname(target), {recursive: true});
const candidate = await fs.mkdtemp(path.join(path.dirname(target), '.rankings-candidate-'));
const run = (command, args) => {
  const result = spawnSync(command, args, {encoding: 'utf8'});
  if (result.error || result.status !== 0) throw Error(result.stderr || 'Candidate build failed');
};
try {
  for (const name of ['species_migration_calendar.csv', 'seasonality_validation.csv', 'seasonality_audit.csv', 'seasonality_changes.csv', 'seasonality_metadata.csv', 'seasonality_metadata.json']) {
    await fs.copyFile(path.join(seasonality, name), path.join(candidate, name));
  }
  run(process.execPath, [path.join(root, 'scripts/build-bird-rankings.mjs'), archive, publicLayer, candidate, path.join(candidate, 'bird-rankings.json')]);
  run('python3', [path.join(root, 'scripts/import-ebird-history.py'), publicLayer, archive, path.join(candidate, 'ebird-history.json')]);
  const rankings = JSON.parse(await fs.readFile(path.join(candidate, 'bird-rankings.json'), 'utf8'));
  const history = JSON.parse(await fs.readFile(path.join(candidate, 'ebird-history.json'), 'utf8'));
  const taxa = new Map(rankings.rankings.borough.map(r => [r.commonName, r]));
  if (history.taxonCount !== rankings.coverage.taxonCount || history.recordCount !== rankings.coverage.recordCount
    || history.species.some(r => !taxa.has(r.commonName) || ['scientificName', 'records'].some(k => taxa.get(r.commonName)[k] !== r[k]) || taxa.get(r.commonName).lastRecorded !== r.lastRecorded)) throw Error('Historical boards disagree');
  await fs.writeFile(path.join(candidate, 'READY'), 'Private review candidate only; publication requires approval.\n');
  await fs.rename(candidate, target);
  console.log(`READY archive-board candidate: ${target} (not published)`);
} catch (error) {
  await fs.rm(candidate, {recursive: true, force: true});
  throw error;
}
