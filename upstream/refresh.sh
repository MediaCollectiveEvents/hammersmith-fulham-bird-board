#!/bin/bash
# Private upstream replacement candidate. Never copies to dist or publishes.
set -euo pipefail
umask 077

: "${UPSTREAM_DIR:?Set UPSTREAM_DIR to the private birds-hf directory}"
: "${ARCHIVE:?Set ARCHIVE to hf_ebird_records_final.csv}"
: "${BOARD_DIR:?Set BOARD_DIR to the validated board checkout}"
: "${BUILD_ROOT:?Set BUILD_ROOT to a private directory outside the board checkout}"
export UPSTREAM_DIR ARCHIVE BOARD_DIR BUILD_ROOT

# Validate configuration before creating or changing outputs.
python3 - <<'PY'
import os
from pathlib import Path
keys=['UPSTREAM_DIR','ARCHIVE','BOARD_DIR','BUILD_ROOT']
if any(not Path(os.environ[k]).is_absolute() for k in keys):
    raise SystemExit('Use absolute paths for all configuration')
p={k:Path(os.environ[k]).resolve(strict=True) for k in keys}
if not p['BUILD_ROOT'].is_dir() or not p['ARCHIVE'].is_file() or p['BUILD_ROOT']==p['BOARD_DIR'] or p['BOARD_DIR'] in p['BUILD_ROOT'].parents:
    raise SystemExit('Invalid isolated build configuration')
PY
for required in "$UPSTREAM_DIR/rebuild_public_layer.sql" "$UPSTREAM_DIR/birds.db" "$BOARD_DIR/scripts/build-seasonality.mjs"; do
  test -f "$required"
done

run=$(mktemp -d "$BUILD_ROOT/refresh.XXXXXXXX")
trap 'result=$?; if [ "$result" -ne 0 ]; then rm -rf -- "$run"; fi' EXIT
export REFRESH_RUN="$run"
mkdir "$run/data"
cp "$UPSTREAM_DIR/birds.db" "$run/birds.db"
# Preserve historical change accounting, without writing to the board checkout.
for file in species_migration_calendar.csv seasonality_changes.csv; do
  cp "$BOARD_DIR/dist/data/$file" "$run/data/$file"
done

python3 - <<'PY'
import os
from pathlib import Path
run=Path(os.environ['REFRESH_RUN'])
text=(Path(os.environ['UPSTREAM_DIR'])/'rebuild_public_layer.sql').read_text()
prefix='/Users/cdparry/Desktop/'
if prefix not in text or "TO '"+prefix+"birds_hf_public.csv'" not in text:
    raise SystemExit('SQL paths changed: review upstream contract before running')
# Only I/O locations change; filters, ranking and all SQL expressions are retained.
text=text.replace(prefix, str(run).replace("'", "''")+'/')
(run/'rebuild_public_layer.sql').write_text(text)
(run/'hf_ebird_records_final.csv').symlink_to(Path(os.environ['ARCHIVE']))
PY
duckdb "$run/birds.db" < "$run/rebuild_public_layer.sql"
test -s "$run/birds_hf_public.csv"
export SEASONALITY_OUTPUT_DIR="$run/data"
npm --prefix "$BOARD_DIR" run build:seasonality -- "$ARCHIVE" "$run/birds_hf_public.csv"
npm --prefix "$BOARD_DIR" run validate:seasonality -- "$run/birds_hf_public.csv"

node --input-type=module - "$run/data" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2];
for (const file of ['species_migration_calendar.csv','seasonality_validation.csv','seasonality_audit.csv','seasonality_changes.csv','seasonality_metadata.csv','seasonality_metadata.json']) {
  if (!fs.statSync(path.join(dir,file)).isFile() || !fs.statSync(path.join(dir,file)).size) throw Error('Missing output: '+file);
}
const m=JSON.parse(fs.readFileSync(path.join(dir,'seasonality_metadata.json'),'utf8'));
if (m.validation_passed!==true || m.reconciliation_passed!==true || m.expected_board_status!=='READY') throw Error('Refresh is not READY');
JS
# The marker is local only. No deployment, dist write, Git operation or promotion.
touch "$run/READY"
printf 'READY candidate (private; not published): %s\n' "$run"
