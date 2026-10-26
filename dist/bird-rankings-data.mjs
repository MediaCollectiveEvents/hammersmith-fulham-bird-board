// Shared by offline validation and the browser. Public aggregates only.
export const views = ['borough', 'recent', 'rising', 'leastRecorded', 'seasonal'];
export const movements = ['Resident', 'Summer Visitor', 'Winter Visitor', 'Partial Migrant', 'Passage Migrant', 'Scarce / Irregular'];
const categories = ['Top 25', 'General Species', 'Current Notable', 'Borough Mega', 'Borough Ghost', 'Most Wanted'];
const fail = message => { throw Error(`Rankings unavailable: ${message}`); };
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const text = value => typeof value === 'string' && value.trim().length > 0;
export const compareName = (a, b) => a.commonName < b.commonName ? -1 : a.commonName > b.commonName ? 1 : 0;
const descending = (a, b) => b.records - a.records || compareName(a, b);
const ascending = (a, b) => a.records - b.records || compareName(a, b);
export const risingOrder = (a, b) => Number(a.rankChange === null) - Number(b.rankChange === null)
  || (b.rankChange ?? 0) - (a.rankChange ?? 0) || descending(a, b);
const fields = (object, keys) => {
  if (!object || typeof object !== 'object' || Array.isArray(object)
    || Object.keys(object).sort().join('|') !== [...keys].sort().join('|')) fail('unexpected or missing fields');
};
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const ordered = (rows, compare) => rows.every((row, i) => !i || compare(rows[i - 1], row) <= 0);

export function validateRankings(data) {
  fields(data, ['schemaVersion', 'source', 'generatedAt', 'archiveRange', 'coverage', 'recentWindow', 'fingerprints', 'availableViews', 'rankings']);
  if (data.schemaVersion !== 1 || data.source !== 'eBird borough archive' || !text(data.generatedAt)
    || !Number.isFinite(Date.parse(data.generatedAt))) fail('invalid source/version/date');
  fields(data.archiveRange, ['first', 'last']);
  const {first, last} = data.archiveRange;
  if (!date(first) || !date(last) || first > last) fail('invalid archive range');
  fields(data.coverage, ['taxonCount', 'recordCount', 'sourceRecordCount', 'excludedRecordCount']);
  const c = data.coverage;
  if (!integer(c.taxonCount, 1) || !integer(c.recordCount, 1) || !integer(c.sourceRecordCount, 1)
    || !integer(c.excludedRecordCount) || c.sourceRecordCount !== c.recordCount + c.excludedRecordCount) fail('invalid coverage');
  fields(data.recentWindow, ['start', 'end', 'days']);
  if (data.recentWindow.days !== 365 || data.recentWindow.end !== last || !date(data.recentWindow.start)
    || (Date.parse(last) - Date.parse(data.recentWindow.start)) / 86400000 !== 364) fail('invalid inclusive window');
  fields(data.fingerprints, ['archive', 'publicLayer', 'calendar', 'metadata']);
  if (Object.values(data.fingerprints).some(h => typeof h !== 'string' || !/^[a-f0-9]{64}$/.test(h))) fail('invalid fingerprints');
  if (!Array.isArray(data.availableViews) || data.availableViews.join('|') !== views.join('|')) fail('unsupported views');
  fields(data.rankings, [...views, 'hotspots']);
  if (!Array.isArray(data.rankings.hotspots) || data.rankings.hotspots.length) fail('unverified hotspot data');
  const borough = data.rankings.borough;
  if (!Array.isArray(borough) || borough.length !== c.taxonCount) fail('taxon count mismatch');
  const names = new Set();
  for (const [i, row] of borough.entries()) {
    fields(row, ['commonName', 'scientificName', 'records', 'firstRecorded', 'lastRecorded', 'category', 'movementType', 'rank']);
    if (!text(row.commonName) || row.commonName !== row.commonName.trim() || names.has(row.commonName)
      || !text(row.scientificName) || !integer(row.records, 1) || row.rank !== i + 1
      || !date(row.firstRecorded) || !date(row.lastRecorded) || row.firstRecorded > row.lastRecorded
      || row.firstRecorded < first || row.lastRecorded > last || !categories.includes(row.category)
      || !movements.includes(row.movementType)) fail('invalid/duplicate taxon');
    names.add(row.commonName);
  }
  if (!ordered(borough, descending) || borough.reduce((sum, row) => sum + row.records, 0) !== c.recordCount
    || [...borough].map(r => r.firstRecorded).sort()[0] !== first
    || [...borough].map(r => r.lastRecorded).sort().at(-1) !== last) fail('borough reconciliation failed');
  const byName = new Map(borough.map(row => [row.commonName, row]));
  const universe = rows => {
    if (!Array.isArray(rows) || rows.length !== names.size || new Set(rows.map(r => r.commonName)).size !== names.size
      || rows.some(r => !names.has(r.commonName))) fail('ranking universe mismatch');
  };
  const recent = data.rankings.recent;
  universe(recent);
  for (const [i, r] of recent.entries()) {
    fields(r, ['commonName', 'records', 'allTimeRank', 'recentRank', 'rankChange']);
    const t = byName.get(r.commonName);
    if (!integer(r.records) || r.records > t.records || r.allTimeRank !== t.rank
      || r.recentRank !== (r.records ? i + 1 : null)
      || r.rankChange !== (r.records ? t.rank - r.recentRank : null)) fail('recent rank mismatch');
    if (t.lastRecorded < data.recentWindow.start && r.records !== 0) fail('recent records predate window');
  }
  if (!ordered(recent, descending)) fail('recent ordering mismatch');
  const recentByName = new Map(recent.map(r => [r.commonName, r]));
  universe(data.rankings.rising);
  for (const r of data.rankings.rising) {
    fields(r, ['commonName', 'records', 'allTimeRank', 'recentRank', 'rankChange']);
    if (Object.keys(r).some(key => r[key] !== recentByName.get(r.commonName)[key])) fail('rising mismatch');
  }
  if (!ordered(data.rankings.rising, risingOrder)) fail('rising order mismatch');
  universe(data.rankings.leastRecorded);
  for (const [i, r] of data.rankings.leastRecorded.entries()) {
    fields(r, ['commonName', 'records', 'rank']);
    if (r.records !== byName.get(r.commonName).records || r.rank !== i + 1) fail('least-recorded mismatch');
  }
  if (!ordered(data.rankings.leastRecorded, ascending)) fail('least-recorded order mismatch');
  fields(data.rankings.seasonal, Array.from({length: 12}, (_, i) => String(i + 1)));
  const sums = new Map(borough.map(r => [r.commonName, 0]));
  for (const rows of Object.values(data.rankings.seasonal)) {
    universe(rows);
    for (const [i, r] of rows.entries()) {
      fields(r, ['commonName', 'records', 'yearsWithRecords', 'rank']);
      if (!integer(r.records) || !integer(r.yearsWithRecords) || r.yearsWithRecords > r.records
        || r.yearsWithRecords > Number(last.slice(0, 4)) - Number(first.slice(0, 4)) + 1
        || (r.records > 0) !== (r.yearsWithRecords > 0) || r.rank !== (r.records ? i + 1 : null)) fail('invalid monthly evidence');
      sums.set(r.commonName, sums.get(r.commonName) + r.records);
    }
    if (!ordered(rows, descending)) fail('seasonal ordering mismatch');
  }
  if (borough.some(r => sums.get(r.commonName) !== r.records)) fail('monthly counts do not reconcile');
  return data;
}

export async function verifyRelease(data, metadataText, calendarText) {
  const metadata = JSON.parse(metadataText);
  if (metadata.expected_board_status !== 'READY' || metadata.validation_passed !== true || metadata.reconciliation_passed !== true
    || metadata.public_species_count !== data.coverage.taxonCount || metadata.calendar_species_count !== data.coverage.taxonCount
    || metadata.missing_from_calendar !== 0 || metadata.unexpected_in_calendar !== 0
    || ['duplicate_species_found', 'invalid_months_found', 'invalid_movement_types_found', 'invalid_confidence_values_found'].some(k => metadata[k] !== false)
    || metadata.generated_at !== data.generatedAt) fail('seasonality release is not READY/matching');
  const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (await hash(metadataText) !== data.fingerprints.metadata || await hash(calendarText) !== data.fingerprints.calendar) fail('release fingerprints differ');
  return data;
}

export function selectRows(data, {view = 'borough', month = 1, search = '', sort = 'rank'} = {}) {
  if (!views.includes(view) || !integer(month, 1) || month > 12) fail('invalid view/month');
  const taxa = new Map(data.rankings.borough.map(r => [r.commonName, r]));
  const source = view === 'seasonal' ? data.rankings.seasonal[String(month)] : data.rankings[view];
  const query = search.trim().toLocaleLowerCase('en-GB');
  const rows = source.map(r => ({...taxa.get(r.commonName), ...r})).filter(r => `${r.commonName} ${r.scientificName}`.toLocaleLowerCase('en-GB').includes(query));
  if (sort === 'name') rows.sort(compareName);
  if (sort === 'records') rows.sort(descending);
  return rows;
}
