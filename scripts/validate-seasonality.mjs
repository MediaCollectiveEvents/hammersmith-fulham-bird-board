import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.SEASONALITY_OUTPUT_DIR || path.join(root, 'dist/data'));
const publicLayer = path.resolve(process.argv[2] || path.join(root, 'data/source/birds_hf_public.csv'));
const schemaPath = path.join(root, 'schemas/seasonality_metadata.schema.json');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function table(filename) {
  const text = (await fs.readFile(path.join(dataDir, filename), 'utf8')).replace(/^\uFEFF/, '');
  const [headers, ...values] = parseCsv(text);
  if (!headers) throw new Error(`${filename} is empty`);
  return values.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

const required = ['species_migration_calendar.csv', 'seasonality_validation.csv', 'seasonality_audit.csv', 'seasonality_changes.csv'];
for (const filename of required) await fs.access(path.join(dataDir, filename));
await fs.access(path.join(dataDir, 'seasonality_metadata.json'));
await fs.access(path.join(dataDir, 'seasonality_metadata.csv'));
const publicText = (await fs.readFile(publicLayer, 'utf8')).replace(/^\uFEFF/, '');
const [publicHeaders, ...publicRows] = parseCsv(publicText);
const publicNameColumn = publicHeaders.findIndex(value => ['COMMON NAME', 'common_name', 'commonName'].includes(value.trim()));
if (publicNameColumn < 0) throw new Error('birds_hf_public.csv must contain a COMMON NAME column');
const rawPublicNames = publicRows.map(row => row[publicNameColumn]?.trim() ?? '');
if (rawPublicNames.some(name => !name)) throw new Error('Public classification layer contains a blank COMMON NAME');
const expectedNames = [...new Set(rawPublicNames)];
if (rawPublicNames.length !== expectedNames.length) throw new Error('Public classification layer contains duplicate COMMON NAME values');
if (!expectedNames.length) throw new Error('Public classification layer contains no species');

const [calendar, summary, audit, changes] = await Promise.all([
  table('species_migration_calendar.csv'),
  table('seasonality_validation.csv'),
  table('seasonality_audit.csv'),
  table('seasonality_changes.csv')
]);
const errors = [];
let metadata;
let metadataCsv;
let schema;
try {
  metadata = JSON.parse(await fs.readFile(path.join(dataDir, 'seasonality_metadata.json'), 'utf8'));
} catch (error) {
  errors.push(`Metadata JSON is invalid: ${error.message}`);
}
try {
  metadataCsv = await table('seasonality_metadata.csv');
} catch (error) {
  errors.push(`Metadata CSV is invalid: ${error.message}`);
}
try {
  schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
} catch (error) {
  errors.push(`Metadata schema is invalid: ${error.message}`);
}
const names = calendar.map(row => row['COMMON NAME']);
const validMovement = new Set(['Resident', 'Partial Migrant', 'Summer Visitor', 'Winter Visitor', 'Passage Migrant', 'Scarce / Irregular']);
const validConfidence = new Set(['High', 'Medium', 'Low']);
if (calendar.length !== expectedNames.length) errors.push(`Calendar has ${calendar.length} rows; public layer has ${expectedNames.length}`);
if (new Set(names).size !== names.length) errors.push('Calendar contains duplicate species');
const publicNameSet = new Set(expectedNames);
const calendarNameSet = new Set(names);
const publicNamesMissingFromCalendar = expectedNames.filter(name => !calendarNameSet.has(name));
const calendarNamesMissingFromPublic = names.filter(name => !publicNameSet.has(name));
if (publicNamesMissingFromCalendar.length) errors.push(`PUBLIC_SPECIES MINUS CALENDAR_SPECIES: ${publicNamesMissingFromCalendar.join(', ')}`);
if (calendarNamesMissingFromPublic.length) errors.push(`CALENDAR_SPECIES MINUS PUBLIC_SPECIES: ${calendarNamesMissingFromPublic.join(', ')}`);
const auditByName = new Map(audit.map(row => [row['COMMON NAME'], row]));
for (const row of calendar) {
  const name = row['COMMON NAME'];
  if (!validMovement.has(row.movement_type)) errors.push(`${name}: invalid movement type`);
  if (!validConfidence.has(row.confidence)) errors.push(`${name}: invalid confidence`);
  for (const key of ['arrival_month', 'departure_month', 'earliest_month', 'latest_month']) {
    if (row[key] !== '' && (!/^\d+$/.test(row[key]) || Number(row[key]) < 1 || Number(row[key]) > 12)) errors.push(`${name}: invalid ${key}`);
  }
  for (const key of ['arrival_month_frequency', 'arrival_years', 'departure_month_frequency', 'departure_years', 'years_used']) {
    if (!/^\d+$/.test(row[key])) errors.push(`${name}: invalid ${key}`);
  }
  if (Number(row.arrival_month_frequency) > Number(row.arrival_years)) errors.push(`${name}: arrival frequency exceeds timing years`);
  if (Number(row.departure_month_frequency) > Number(row.departure_years)) errors.push(`${name}: departure frequency exceeds timing years`);
  if (row.movement_type === 'Resident' && (row.arrival_month || row.departure_month)) errors.push(`${name}: Resident has arrival/departure month`);
  const evidence = auditByName.get(name);
  if (!evidence) errors.push(`${name}: missing audit row`);
  else if (Number(evidence.records) < 10 || Number(evidence.years_used) < 3) {
    if (row.movement_type !== 'Scarce / Irregular' || row.arrival_month || row.departure_month || row.confidence !== 'Low') errors.push(`${name}: low evidence classification is invalid`);
  }
}
for (const change of changes) {
  if (change.old_value === change.new_value) {
    errors.push(`Change report contains a no-op record for ${change['COMMON NAME']} (${change.field_changed})`);
  }
}
if (summary.length !== 1 || summary[0]?.validation_passed !== 'true') errors.push('Seasonality validation summary did not pass');
if (metadata && schema) {
  const ajv = new Ajv2020({allErrors: true});
  addFormats(ajv);
  const validateMetadata = ajv.compile(schema);
  if (!validateMetadata(metadata)) {
    for (const issue of validateMetadata.errors || []) {
      errors.push(`Metadata schema ${issue.instancePath || '/'}: ${issue.message}`);
    }
  }
  if (metadata.validation_passed !== true) errors.push('Metadata validation_passed is not true');
  if (metadata.reconciliation_passed !== true) errors.push('Metadata reconciliation failed');
  if (metadata.expected_board_status !== 'READY') errors.push(`Expected board status is ${metadata.expected_board_status}`);
  if (metadata.expected_board_status === 'READY' && metadata.validation_passed !== true) errors.push('READY status dependency violated');
  if (metadata.missing_from_calendar !== 0 || metadata.unexpected_in_calendar !== 0) errors.push('Metadata reconciliation counts are non-zero');
  if (metadata.duplicate_species_found !== false || metadata.invalid_months_found !== false || metadata.invalid_movement_types_found !== false || metadata.invalid_confidence_values_found !== false) {
    errors.push('Metadata reports a duplicate species or invalid calendar value');
  }
  if (metadata.public_species_count !== metadata.calendar_species_count || metadata.calendar_species_count !== calendar.length) errors.push('Metadata species counts do not match generated calendar');
  if (metadata.changes_detected !== metadata.arrival_changes + metadata.departure_changes + metadata.movement_type_changes + metadata.confidence_changes) errors.push('Metadata change counts do not reconcile');
  if (!Number.isFinite(Date.parse(metadata.generated_at))) errors.push('Metadata generated_at is not a valid timestamp');
  if (metadataCsv?.length !== 1) errors.push('Metadata CSV must contain exactly one data row');
  else {
    for (const [key, value] of Object.entries(metadata)) {
      const csvValue = metadataCsv[0][key];
      if (String(value) !== String(csvValue)) errors.push(`Metadata CSV value differs from JSON for ${key}`);
    }
  }
  if (summary.length === 1) {
    if (summary[0].expected_board_status !== metadata.expected_board_status) errors.push('Validation summary status differs from metadata');
    if (summary[0].reconciliation_passed !== String(metadata.reconciliation_passed)) errors.push('Validation summary reconciliation differs from metadata');
  }
}
if (errors.length) throw new Error(`Seasonality validation failed:\n${errors.join('\n')}`);
console.log(`Species reconciliation passed: public=${expectedNames.length}, calendar=${calendar.length}, PUBLIC_SPECIES minus CALENDAR_SPECIES=0, CALENDAR_SPECIES minus PUBLIC_SPECIES=0.`);
