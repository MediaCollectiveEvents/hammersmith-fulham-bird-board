import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = process.argv[2];
const publicLayer = process.argv[3];
if (!archive || !publicLayer) {
  throw new Error('Usage: node scripts/build-seasonality.mjs <hf_ebird_records_final.csv> <birds_hf_public.csv>');
}

// Close the board gate before touching outputs. If generation stops early, the
// previously published READY marker cannot make a stale calendar look current.
const outputDir = path.resolve(process.env.SEASONALITY_OUTPUT_DIR || path.join(root, 'dist/data'));
await fs.mkdir(outputDir, {recursive: true});
const incompleteMetadata = {
  calendar_version: '1.0.0',
  generated_at: new Date().toISOString(),
  source_archive: path.basename(archive),
  public_species_source: path.basename(publicLayer),
  public_species_count: 0,
  calendar_species_count: 0,
  reconciliation_passed: false,
  validation_passed: false,
  expected_board_status: 'INCOMPLETE'
};
const csvCell = value => /[",\r\n]/.test(String(value))
  ? `"${String(value).replaceAll('"', '""')}"`
  : String(value);
await fs.writeFile(path.join(outputDir, 'seasonality_metadata.json'), `${JSON.stringify(incompleteMetadata, null, 2)}\n`);
await fs.writeFile(
  path.join(outputDir, 'seasonality_metadata.csv'),
  `${Object.keys(incompleteMetadata).map(csvCell).join(',')}\n${Object.values(incompleteMetadata).map(csvCell).join(',')}\n`
);

for (const script of ['generate-seasonality.mjs', 'validate-seasonality.mjs']) {
  const args = [path.join(root, 'scripts', script), ...(script.startsWith('generate') ? [archive, publicLayer] : [publicLayer])];
  const result = spawnSync(process.execPath, args, {cwd: root, env: process.env, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (script.startsWith('validate')) {
      try {
        const metadataPath = path.join(outputDir, 'seasonality_metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        metadata.validation_passed = false;
        metadata.expected_board_status = 'FAILED';
        await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
        await fs.writeFile(
          path.join(outputDir, 'seasonality_metadata.csv'),
          `${Object.keys(metadata).map(csvCell).join(',')}\n${Object.values(metadata).map(csvCell).join(',')}\n`
        );
      } catch {
        // The INCOMPLETE marker written above remains the fail-closed status.
      }
    }
    process.exit(result.status ?? 1);
  }
}
