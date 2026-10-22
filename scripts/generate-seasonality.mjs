import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(process.argv[2] || path.join(root, 'data/source/hf_ebird_records_final.csv'));
const publicSpeciesPath = path.resolve(process.argv[3] || path.join(root, 'data/source/birds_hf_public.csv'));
const outputDir = path.resolve(process.env.SEASONALITY_OUTPUT_DIR || path.join(root, 'dist/data'));
const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date()).reduce((parts, part) => ({...parts, [part.type]: part.value}), {});
const runDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
const runYear = Number(runDate.slice(0, 4));
const previousCalendarPath = path.join(outputDir, 'species_migration_calendar.csv');
const previousChangesPath = path.join(outputDir, 'seasonality_changes.csv');
const metadataJsonPath = path.join(outputDir, 'seasonality_metadata.json');
const metadataCsvPath = path.join(outputDir, 'seasonality_metadata.csv');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvText(headers, rows) {
  return `${[headers, ...rows.map(row => headers.map(header => row[header] ?? ''))]
    .map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

function publicSpeciesFromCsv(text) {
  const [headers, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  const nameIndex = headers.findIndex(name => ['COMMON NAME', 'common_name', 'commonName'].includes(name.trim()));
  if (nameIndex < 0) throw new Error('Public classification CSV must contain a COMMON NAME column');
  const rawNames = rows.map(row => row[nameIndex]?.trim() ?? '');
  if (rawNames.some(name => !name)) throw new Error('Public species layer contains a blank COMMON NAME');
  const names = [...new Set(rawNames)].sort((a, b) => a.localeCompare(b, 'en-GB'));
  if (rawNames.length !== names.length) throw new Error(`Public species layer contains duplicate COMMON NAME values (${rawNames.length} rows, ${names.length} unique)`);
  if (!names.length) throw new Error('Public species layer contains no species');
  return names;
}

function recordsFromCsv(text, publicNames) {
  const [headers, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  const column = new Map(headers.map((name, index) => [name.trim(), index]));
  for (const required of ['COMMON NAME', 'OBSERVATION DATE']) {
    if (!column.has(required)) throw new Error(`Input CSV is missing required column: ${required}`);
  }
  const value = (row, name) => row[column.get(name)]?.trim() ?? '';
  const seenIds = new Set();
  const species = new Map();
  const publicSet = new Set(publicNames);
  let skippedOutsidePublicSet = 0, skippedInvalid = 0, skippedUnapproved = 0, duplicateIds = 0;
  for (const row of rows) {
    const name = value(row, 'COMMON NAME');
    if (!publicSet.has(name)) { skippedOutsidePublicSet++; continue; }
    const date = value(row, 'OBSERVATION DATE').slice(0, 10);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      skippedInvalid++; continue;
    }
    if (column.has('APPROVED') && value(row, 'APPROVED') !== '1') { skippedUnapproved++; continue; }
    const id = column.has('GLOBAL UNIQUE IDENTIFIER') ? value(row, 'GLOBAL UNIQUE IDENTIFIER') : '';
    if (id && seenIds.has(id)) { duplicateIds++; continue; }
    if (id) seenIds.add(id);
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const item = species.get(name) || {name, records: 0, months: new Set(), years: new Map(), earliest: 13, latest: 0};
    item.records++;
    item.months.add(month);
    item.earliest = Math.min(item.earliest, month);
    item.latest = Math.max(item.latest, month);
    const yearDates = item.years.get(year) || [];
    yearDates.push(date);
    item.years.set(year, yearDates);
    species.set(name, item);
  }
  return {species, skippedOutsidePublicSet, skippedInvalid, skippedUnapproved, duplicateIds};
}

function mode(counts, tieDirection) {
  if (!counts.size) return null;
  return [...counts].sort((a, b) => b[1] - a[1] || (tieDirection === 'early' ? a[0] - b[0] : b[0] - a[0]))[0][0];
}

function circularDistance(a, b) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 12 - distance);
}

function confidenceFor(yearsUsed, records) {
  if (yearsUsed >= 8 && records >= 50) return 'High';
  if (yearsUsed >= 4 && yearsUsed <= 7 && records >= 10) return 'Medium';
  return 'Low';
}

function classify(item, yearsUsed, arrival, departure) {
  if (yearsUsed < 3 || item.records < 10) return 'Scarce / Irregular';
  if (item.months.size >= 10) return 'Resident';
  if (item.months.size >= 7 && item.months.size <= 9) return 'Partial Migrant';
  if (item.months.size <= 4) return 'Passage Migrant';
  const springArrival = [2, 3, 4, 5, 6].includes(arrival);
  const autumnDeparture = [8, 9, 10, 11, 12].includes(departure);
  const autumnArrival = [8, 9, 10, 11, 12, 1].includes(arrival);
  const springDeparture = [1, 2, 3, 4, 5].includes(departure);
  if (springArrival && autumnDeparture && arrival < departure) return 'Summer Visitor';
  if (autumnArrival && springDeparture && (arrival >= 8 || departure < arrival)) return 'Winter Visitor';
  return 'Scarce / Irregular';
}

function readTable(text, requiredHeaders) {
  const [headers, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!headers || requiredHeaders.some(header => !headers.includes(header))) return [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function monthNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12 ? number : null;
}

function validateCalendar(calendarRows, auditRows) {
  const issues = [];
  const movementTypes = new Set(['Resident', 'Partial Migrant', 'Summer Visitor', 'Winter Visitor', 'Passage Migrant', 'Scarce / Irregular']);
  const confidenceTypes = new Set(['High', 'Medium', 'Low']);
  const names = calendarRows.map(row => row['COMMON NAME']);
  if (new Set(names).size !== names.length) issues.push('Duplicate COMMON NAME values');
  const auditByName = new Map(auditRows.map(row => [row['COMMON NAME'], row]));
  for (const row of calendarRows) {
    if (!row['COMMON NAME']) issues.push('Blank COMMON NAME');
    if (!movementTypes.has(row.movement_type)) issues.push(`${row['COMMON NAME']}: invalid movement_type`);
    if (!confidenceTypes.has(row.confidence)) issues.push(`${row['COMMON NAME']}: invalid confidence`);
    for (const field of ['arrival_month', 'departure_month', 'earliest_month', 'latest_month']) {
      const value = row[field];
      if (value !== '' && monthNumber(value) === null) issues.push(`${row['COMMON NAME']}: invalid ${field}`);
    }
    const arrival = monthNumber(row.arrival_month), departure = monthNumber(row.departure_month);
    if (row.movement_type === 'Resident' && (arrival !== null || departure !== null)) issues.push(`${row['COMMON NAME']}: resident has arrival/departure month`);
    if (row.movement_type === 'Scarce / Irregular' && (arrival !== null || departure !== null)) issues.push(`${row['COMMON NAME']}: scarce/irregular has arrival/departure month`);
    const audit = auditByName.get(row['COMMON NAME']);
    if (!audit) { issues.push(`${row['COMMON NAME']}: missing audit row`); continue; }
    const records = Number(audit.records), years = Number(audit.years_used);
    if (records < 10 || years < 3) {
      if (row.movement_type !== 'Scarce / Irregular' || arrival !== null || departure !== null || row.confidence !== 'Low') {
        issues.push(`${row['COMMON NAME']}: low evidence must be Scarce / Irregular with null timing and Low confidence`);
      }
    }
  }
  return issues;
}

await fs.access(inputPath).catch(() => { throw new Error(`Seasonality source not found: ${inputPath}`); });
await fs.access(publicSpeciesPath).catch(() => { throw new Error(`Validated public species layer not found: ${publicSpeciesPath}. Build birds_hf_public.csv with the existing classification/exclusion workflow first.`); });
await fs.mkdir(outputDir, {recursive: true});
let previousCalendar = [];
let previousChanges = [];
try { previousCalendar = readTable(await fs.readFile(previousCalendarPath, 'utf8'), ['COMMON NAME', 'movement_type', 'arrival_month', 'departure_month']); } catch {}
try { previousChanges = readTable(await fs.readFile(previousChangesPath, 'utf8'), ['COMMON NAME', 'field_changed', 'old_value', 'new_value', 'change_date']); } catch {}

const publicNames = publicSpeciesFromCsv(await fs.readFile(publicSpeciesPath, 'utf8'));
const parsed = recordsFromCsv(await fs.readFile(inputPath, 'utf8'), publicNames);
const calendarRows = [], auditRows = [];
const previousByName = new Map(previousCalendar.map(row => [row['COMMON NAME'], row]));
for (const name of publicNames) {
  const item = parsed.species.get(name) || {name, records: 0, months: new Set(), years: new Map(), earliest: null, latest: null};
  const completedYears = [...item.years.entries()].filter(([year]) => year < runYear).sort((a, b) => a[0] - b[0]);
  const yearsUsed = completedYears.length;
  const arrivalCounts = new Map(), departureCounts = new Map();
  for (const [, dates] of completedYears) {
    dates.sort();
    const first = Number(dates[0].slice(5, 7));
    const last = Number(dates.at(-1).slice(5, 7));
    arrivalCounts.set(first, (arrivalCounts.get(first) || 0) + 1);
    departureCounts.set(last, (departureCounts.get(last) || 0) + 1);
  }
  let arrival = mode(arrivalCounts, 'early');
  let departure = mode(departureCounts, 'late');
  let movementType = classify(item, yearsUsed, arrival, departure);
  if (movementType === 'Resident' || movementType === 'Scarce / Irregular') { arrival = null; departure = null; }
  const confidence = confidenceFor(yearsUsed, item.records);
  const calendar = {
    'COMMON NAME': item.name,
    movement_type: movementType,
    arrival_month: arrival ?? '',
    arrival_month_frequency: arrival === null ? 0 : (arrivalCounts.get(arrival) || 0),
    arrival_years: arrivalCounts.size ? [...arrivalCounts.values()].reduce((sum, value) => sum + value, 0) : 0,
    departure_month: departure ?? '',
    departure_month_frequency: departure === null ? 0 : (departureCounts.get(departure) || 0),
    departure_years: departureCounts.size ? [...departureCounts.values()].reduce((sum, value) => sum + value, 0) : 0,
    earliest_month: item.earliest ?? '',
    latest_month: item.latest ?? '',
    years_used: yearsUsed,
    confidence,
    last_calculated: runDate
  };
  calendarRows.push(calendar);

  const issues = [];
  if (item.records < 10) issues.push('Low record count');
  if (yearsUsed < 3) issues.push('Insufficient years');
  const hasArrivalTie = [...arrivalCounts.values()].filter(count => count === Math.max(0, ...arrivalCounts.values())).length > 1;
  const hasDepartureTie = [...departureCounts.values()].filter(count => count === Math.max(0, ...departureCounts.values())).length > 1;
  if (hasArrivalTie) issues.push('Arrival tie detected');
  if (hasDepartureTie) issues.push('Departure tie detected');
  if (yearsUsed >= 3 && ((arrivalCounts.get(arrival) || 0) / yearsUsed < 0.5 || (departureCounts.get(departure) || 0) / yearsUsed < 0.5)) issues.push('Weak seasonal signal');
  const outlier = (counts, typical, label) => {
    if (typical === null) return;
    const unusual = [...counts].some(([month, count]) => count === 1 && circularDistance(month, typical) >= 2);
    if (unusual) issues.push(`Outlier influence (${label})`);
  };
  outlier(arrivalCounts, arrival, 'arrival');
  outlier(departureCounts, departure, 'departure');
  const previous = previousByName.get(item.name);
  if (previous) {
    for (const [field, nextValue] of [['arrival_month', arrival], ['departure_month', departure]]) {
      const oldValue = monthNumber(previous[field]);
      if (oldValue !== null && nextValue !== null && circularDistance(oldValue, nextValue) > 2) issues.push('Timing shift > 2 months');
    }
  }
  auditRows.push({'COMMON NAME': item.name, records: item.records, years_used: yearsUsed, confidence, issues: [...new Set(issues)].join('; ')});
}

const auditByName = new Map(auditRows.map(row => [row['COMMON NAME'], row]));
const validationIssues = validateCalendar(calendarRows, auditRows);
if (calendarRows.length !== publicNames.length) validationIssues.push('Calendar species count does not match validated public layer');
if (new Set(calendarRows.map(row => row['COMMON NAME'])).size !== new Set(publicNames).size || publicNames.some(name => !calendarRows.some(row => row['COMMON NAME'] === name))) validationIssues.push('Calendar species do not match validated public layer');
const changes = [...previousChanges];
const runChanges = [];
const oldByName = new Map(previousCalendar.map(row => [row['COMMON NAME'], row]));
if (previousCalendar.length) {
  const newByName = new Map(calendarRows.map(row => [row['COMMON NAME'], row]));
  const names = new Set([...oldByName.keys(), ...newByName.keys()]);
  for (const name of names) {
    const oldRow = oldByName.get(name), newRow = newByName.get(name);
    for (const field of ['arrival_month', 'departure_month', 'movement_type', 'confidence']) {
      const oldValue = oldRow?.[field] || '';
      const newValue = newRow?.[field] || '';
      if (oldValue === newValue) continue;
      const change = {'COMMON NAME': name, field_changed: field, old_value: oldValue, new_value: newValue, change_date: runDate};
      changes.push(change);
      runChanges.push(change);
    }
  }
}
const changeRows = [...new Map(changes.map(row => [`${row['COMMON NAME']}|${row.field_changed}|${row.old_value}|${row.new_value}|${row.change_date}`, row])).values()]
  .sort((a, b) => a['COMMON NAME'].localeCompare(b['COMMON NAME'], 'en-GB') || a.field_changed.localeCompare(b.field_changed) || a.change_date.localeCompare(b.change_date));

const confidenceCount = confidence => calendarRows.filter(row => row.confidence === confidence).length;
const validationRow = {
  run_date: runDate,
  species_processed: calendarRows.length,
  species_with_arrival_month: calendarRows.filter(row => row.arrival_month !== '').length,
  species_with_departure_month: calendarRows.filter(row => row.departure_month !== '').length,
  resident_species: calendarRows.filter(row => row.movement_type === 'Resident').length,
  scarce_irregular_species: calendarRows.filter(row => row.movement_type === 'Scarce / Irregular').length,
  high_confidence_species: confidenceCount('High'),
  medium_confidence_species: confidenceCount('Medium'),
  low_confidence_species: confidenceCount('Low'),
  validation_passed: validationIssues.length === 0 ? 'true' : 'false'
};

const publicNameSet = new Set(publicNames);
const calendarNames = calendarRows.map(row => row['COMMON NAME']);
const calendarNameSet = new Set(calendarNames);
const missingFromCalendar = publicNames.filter(name => !calendarNameSet.has(name));
const unexpectedInCalendar = calendarNames.filter(name => !publicNameSet.has(name));
const invalidMonthValues = calendarRows.some(row =>
  ['arrival_month', 'departure_month', 'earliest_month', 'latest_month']
    .some(field => row[field] !== '' && monthNumber(row[field]) === null)
);
const movementTypes = new Set(['Resident', 'Partial Migrant', 'Summer Visitor', 'Winter Visitor', 'Passage Migrant', 'Scarce / Irregular']);
const confidenceTypes = new Set(['High', 'Medium', 'Low']);
const duplicateSpeciesFound = new Set(calendarNames).size !== calendarNames.length;
const invalidMovementTypesFound = calendarRows.some(row => !movementTypes.has(row.movement_type));
const invalidConfidenceValuesFound = calendarRows.some(row => !confidenceTypes.has(row.confidence));
const reconciliationPassed = missingFromCalendar.length === 0 && unexpectedInCalendar.length === 0;
const countChanges = field => runChanges.filter(change => change.field_changed === field).length;
const metadata = {
  calendar_version: '1.0.0',
  generated_at: new Date().toISOString(),
  source_archive: path.basename(inputPath),
  public_species_source: path.basename(publicSpeciesPath),
  public_species_count: publicNames.length,
  calendar_species_count: calendarRows.length,
  reconciliation_passed: reconciliationPassed,
  missing_from_calendar: missingFromCalendar.length,
  unexpected_in_calendar: unexpectedInCalendar.length,
  species_with_arrivals: validationRow.species_with_arrival_month,
  species_with_departures: validationRow.species_with_departure_month,
  resident_species: validationRow.resident_species,
  scarce_irregular_species: validationRow.scarce_irregular_species,
  high_confidence_species: validationRow.high_confidence_species,
  medium_confidence_species: validationRow.medium_confidence_species,
  low_confidence_species: validationRow.low_confidence_species,
  duplicate_species_found: duplicateSpeciesFound,
  invalid_months_found: invalidMonthValues,
  invalid_movement_types_found: invalidMovementTypesFound,
  invalid_confidence_values_found: invalidConfidenceValuesFound,
  changes_detected: runChanges.length,
  arrival_changes: countChanges('arrival_month'),
  departure_changes: countChanges('departure_month'),
  movement_type_changes: countChanges('movement_type'),
  confidence_changes: countChanges('confidence'),
  methodology_version: '1.0',
  calculation_basis: 'public-layer-filtered archive analysis',
  validation_passed: validationIssues.length === 0
};
metadata.expected_board_status =
  metadata.validation_passed &&
  metadata.reconciliation_passed &&
  !metadata.duplicate_species_found &&
  !metadata.invalid_months_found &&
  !metadata.invalid_movement_types_found &&
  !metadata.invalid_confidence_values_found
    ? 'READY'
    : 'FAILED';

Object.assign(validationRow, {
  missing_from_calendar: metadata.missing_from_calendar,
  unexpected_in_calendar: metadata.unexpected_in_calendar,
  reconciliation_passed: String(metadata.reconciliation_passed),
  changes_detected: metadata.changes_detected,
  arrival_changes: metadata.arrival_changes,
  departure_changes: metadata.departure_changes,
  movement_type_changes: metadata.movement_type_changes,
  confidence_changes: metadata.confidence_changes,
  expected_board_status: metadata.expected_board_status,
  issues: validationIssues.join('; ')
});

const outputFiles = [
  ['species_migration_calendar.csv', ['COMMON NAME', 'movement_type', 'arrival_month', 'arrival_month_frequency', 'arrival_years', 'departure_month', 'departure_month_frequency', 'departure_years', 'earliest_month', 'latest_month', 'years_used', 'confidence', 'last_calculated'], calendarRows],
  ['seasonality_validation.csv', Object.keys(validationRow), [validationRow]],
  ['seasonality_audit.csv', ['COMMON NAME', 'records', 'years_used', 'confidence', 'issues'], auditRows],
  ['seasonality_changes.csv', ['COMMON NAME', 'field_changed', 'old_value', 'new_value', 'change_date'], changeRows]
];
for (const [filename, headers, rows] of outputFiles) {
  await fs.writeFile(path.join(outputDir, filename), csvText(headers, rows));
}
await fs.writeFile(metadataJsonPath, `${JSON.stringify(metadata, null, 2)}\n`);
await fs.writeFile(metadataCsvPath, csvText(Object.keys(metadata), [metadata]));
if (validationIssues.length) throw new Error(`Seasonality validation failed:\n${validationIssues.join('\n')}`);
console.log(`Generated seasonality for ${calendarRows.length} public species using ${[...parsed.species.values()].reduce((sum, item) => sum + item.records, 0)} source records; timing uses years before ${runYear}.`);
console.log(`Joined archive rows to the validated public species set; excluded ${parsed.skippedOutsidePublicSet} rows outside that set, skipped ${parsed.skippedInvalid} invalid rows, ${parsed.skippedUnapproved} unapproved rows, and ${parsed.duplicateIds} duplicate identifiers.`);
console.log(`Arrivals: ${validationRow.species_with_arrival_month}; departures: ${validationRow.species_with_departure_month}; validation: ${validationRow.validation_passed}.`);
