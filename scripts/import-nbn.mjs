import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/import-nbn.mjs <NBN occurrence CSV>');

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

const raw = await fs.readFile(input, 'utf8');
const [headers, ...values] = parseCsv(raw);
const index = new Map(headers.map((name, i) => [name.trim(), i]));
const get = (row, name) => row[index.get(name)]?.trim() || '';
for (const required of ['Class', 'Scientific name', 'Common name', 'Taxon Rank', 'Event Date', 'Year', 'Month', 'Licence', 'Data provider', 'Dataset name']) {
  if (!index.has(required)) throw new Error(`Missing required NBN CSV column: ${required}`);
}

const taxa = new Map();
const datasets = new Map();
const licences = new Map();
const years = new Set();
let included = 0, skippedNonBird = 0, skippedInvalidDate = 0, monthPrecisionRecords = 0;
let firstDate = null, lastDate = null;

for (const row of values) {
  if (get(row, 'Class').toLowerCase() !== 'aves') { skippedNonBird++; continue; }
  const scientificName = get(row, 'Scientific name');
  const eventDate = get(row, 'Event Date');
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate);
  const year = Number(get(row, 'Year') || match?.[1]);
  const month = Number(get(row, 'Month') || match?.[2]);
  if (!scientificName || !year || month < 1 || month > 12) { skippedInvalidDate++; continue; }
  const precision = match ? 'day' : 'month';
  const date = match ? match[0] : `${year}-${String(month).padStart(2, '0')}`;
  const orderDate = match ? match[0] : `${date}-01`;
  if (!match) monthPrecisionRecords++;
  const commonName = get(row, 'Common name');
  const taxonRank = get(row, 'Taxon Rank');
  const key = `${scientificName}|${taxonRank}`;
  let taxon = taxa.get(key);
  if (!taxon) {
    taxon = {commonName, scientificName, taxonRank, records: 0};
    taxa.set(key, taxon);
  }
  taxon.records++;
  firstDate = firstDate === null || date < firstDate ? date : firstDate;
  lastDate = lastDate === null || date > lastDate ? date : lastDate;
  const licence = get(row, 'Licence') || 'Not supplied';
  const provider = get(row, 'Data provider') || 'Not supplied';
  const dataset = get(row, 'Dataset name') || 'Not supplied';
  const dataKey = `${provider}\u0000${dataset}\u0000${licence}`;
  const source = datasets.get(dataKey) || {provider, dataset, licence, records: 0};
  source.records++;
  datasets.set(dataKey, source);
  licences.set(licence, (licences.get(licence) || 0) + 1);
  included++;
}

const sourceList = [...datasets.values()].sort((a,b) => a.provider.localeCompare(b.provider) || a.dataset.localeCompare(b.dataset));
const species = [...taxa.values()].map(taxon => ({
  commonName: taxon.commonName || taxon.scientificName,
  scientificName: taxon.scientificName,
  taxonRank: taxon.taxonRank,
  records: taxon.records
})).sort((a,b) => a.commonName.localeCompare(b.commonName) || a.scientificName.localeCompare(b.scientificName));

const output = {
  source: 'NBN Atlas occurrence download',
  retrievedFromNbnAtlas: '2026-10-10',
  dataDateRange: {first: firstDate, last: lastDate},
  recordCount: included,
  taxonCount: species.length,
  recordsWithMonthOnlyDate: monthPrecisionRecords,
  scope: 'The supplied export was confirmed by the project owner as records within the London Borough of Hammersmith & Fulham. Only bird names and overall occurrence-record totals are retained; dates, recorder names and coordinates are not published.',
  licenceCounts: Object.fromEntries([...licences.entries()].sort(([a],[b]) => a.localeCompare(b))),
  dataSources: sourceList,
  attribution: [
    'NBN Trust (2026). The National Biodiversity Network (NBN) Atlas. https://nbnatlas.org/ (accessed 10 October 2026).',
    ...sourceList.map(source => `Records provided by ${source.provider}, dataset “${source.dataset}”, accessed through the NBN Atlas (${source.licence}).`)
  ],
  notes: [
    'Counts are occurrence records, not individual bird totals.',
    'The NBN Atlas is an incomplete source. This project uses it only as a list of bird taxa recorded in the borough, not to forecast seasonal presence or absence.',
    'Counts are records in the supplied export; they are not counts of individual birds. Missing entries do not establish absence.',
    'CC-BY-NC records are included for this non-commercial community project. Keep this dataset and resulting display non-commercial and retain attribution.'
  ],
  species
};

if (!included) throw new Error('No dated bird records were found in the NBN CSV.');
const outputPath = path.resolve(here, '../dist/data/nbn-history.json');
await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${included} bird records for ${species.length} taxa (${firstDate} to ${lastDate}); ${monthPrecisionRecords} records have month-level dates; skipped ${skippedNonBird} non-bird and ${skippedInvalidDate} invalid-date rows.`);
