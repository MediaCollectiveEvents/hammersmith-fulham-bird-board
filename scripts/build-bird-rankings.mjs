import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateRankings, verifyRelease} from '../dist/bird-rankings-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [archive, publicLayer, seasonalityDir, output] = process.argv.slice(2);
if (!archive || !publicLayer || !seasonalityDir || !output || process.argv.length !== 6) {
  throw Error('Usage: build-bird-rankings.mjs <private-archive.csv> <public.csv> <validated-seasonality-dir> <output.json>');
}
const protectedPaths = [archive, publicLayer, path.join(seasonalityDir, 'seasonality_metadata.json'), path.join(seasonalityDir, 'species_migration_calendar.csv')].map(p => path.resolve(p));
if (!output.endsWith('.json') || protectedPaths.includes(path.resolve(output))) throw Error('Output must be a separate aggregate JSON; source files cannot be replaced');
// Reuse the full validator, without regenerating or modifying seasonality.
const check = spawnSync(process.execPath, [path.join(root, 'scripts/validate-seasonality.mjs'), publicLayer], {
  env: {...process.env, SEASONALITY_OUTPUT_DIR: path.resolve(seasonalityDir)}, encoding: 'utf8'
});
if (check.error || check.status !== 0) throw Error('Existing seasonality validation failed; rankings not replaced');
const calendarPath = path.join(seasonalityDir, 'species_migration_calendar.csv');
const metadataPath = path.join(seasonalityDir, 'seasonality_metadata.json');
const result = spawnSync('python3', [path.join(root, 'scripts/lib/bird_rankings.py'), archive, publicLayer, calendarPath, metadataPath], {
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
});
if (result.error || result.status !== 0) throw Error(result.stderr || 'Ranking aggregation failed');
const data = validateRankings(JSON.parse(result.stdout));
await verifyRelease(data, await fs.readFile(metadataPath, 'utf8'), await fs.readFile(calendarPath, 'utf8'));
const target = path.resolve(output);
await fs.mkdir(path.dirname(target), {recursive: true});
// Write a sibling temporary file, then atomically replace only this aggregate.
const temporary = `${target}.candidate-${process.pid}`;
try {
  await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, {flag: 'wx'});
  await fs.rename(temporary, target);
} finally {
  await fs.rm(temporary, {force: true});
}
console.log(`Validated rankings: ${data.coverage.taxonCount} taxa; ${data.coverage.recordCount} records; ${data.recentWindow.start}–${data.recentWindow.end}.`);
