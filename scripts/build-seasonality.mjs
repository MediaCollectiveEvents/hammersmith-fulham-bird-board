import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = process.argv[2];
const publicLayer = process.argv[3];
if (!archive || !publicLayer) {
  throw new Error('Usage: node scripts/build-seasonality.mjs <hf_ebird_records_final.csv> <birds_hf_public.csv>');
}

for (const script of ['generate-seasonality.mjs', 'validate-seasonality.mjs']) {
  const args = [path.join(root, 'scripts', script), ...(script.startsWith('generate') ? [archive, publicLayer] : [publicLayer])];
  const result = spawnSync(process.execPath, args, {cwd: root, env: process.env, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
