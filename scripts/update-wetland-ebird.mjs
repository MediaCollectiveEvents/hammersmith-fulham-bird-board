const apiKey = process.env.EBIRD_API_KEY;
if (!apiKey) throw new Error('Set EBIRD_API_KEY in the GitHub Actions repository secrets.');
const apiRoot = 'https://api.ebird.org/v2';
const outputPath = new URL('../dist/data/wetland-centre-observations.json', import.meta.url);
const target = {name: 'WWT London Wetland Centre (from 2000)', lat: 51.4774486, lng: -0.235101};
const headers = {'X-eBirdApiToken': apiKey};

async function getJson(url) {
  const response = await fetch(url, {headers, signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(response.status + ' from eBird ' + url.split('?')[0] + ': ' + await response.text());
  return response.json();
}
function normalizeName(name) {
  return String(name || '').replace(/^(?:Eurasian|European)\s+/i, '').replace(/^Gray(?=\s)/i, 'Grey');
}
function distanceSquared(hotspot) {
  const latDelta = Number(hotspot.lat) - target.lat;
  const lngDelta = (Number(hotspot.lng) - target.lng) * Math.cos(target.lat * Math.PI / 180);
  return latDelta * latDelta + lngDelta * lngDelta;
}

const hotspotUrl = new URL(apiRoot + '/ref/hotspot/geo');
hotspotUrl.search = new URLSearchParams({lat: String(target.lat), lng: String(target.lng), dist: '5', fmt: 'json'});
const hotspots = await getJson(hotspotUrl);
const matches = hotspots.filter(h => /WWT London Wetland Centre/i.test(String(h.name || h.locName || '')));
const hotspot = matches.find(h => String(h.name || h.locName || '').toLowerCase() === target.name.toLowerCase()) ||
  matches.sort((a, b) => distanceSquared(a) - distanceSquared(b))[0];
if (!hotspot) throw new Error('Could not find the WWT London Wetland Centre eBird hotspot near the reserve coordinates.');

const params = new URLSearchParams({back: '30', includeProvisional: 'false', maxResults: '10000', detail: 'full'});
const observationsUrl = new URL(apiRoot + '/data/obs/' + encodeURIComponent(hotspot.locId) + '/recent');
observationsUrl.search = params;
const notableUrl = new URL(apiRoot + '/data/obs/' + encodeURIComponent(hotspot.locId) + '/recent/notable');
notableUrl.search = params;
const results = await Promise.all([getJson(observationsUrl), getJson(notableUrl)]);
const observations = results[0];
const notable = new Set(results[1].map(o => String(o.speciesCode || o.comName) + '|' + String(o.obsDt).slice(0, 10)));

const fs = await import('node:fs/promises');
let feed;
try { feed = JSON.parse(await fs.readFile(outputPath, 'utf8')); }
catch { feed = {source: 'eBird', hotspotName: target.name, hotspotId: hotspot.locId, updatedAt: null, records: []}; }
const recordKey = r => [r.speciesCode || r.species, r.date, r.checklistId || ''].join('|');
const recordsByKey = new Map((feed.records || []).map(record => {
  const normalized = {...record, species: normalizeName(record.species)};
  return [recordKey(normalized), normalized];
}));
let accepted = 0;
for (const observation of observations) {
  if (observation.obsValid !== true) continue;
  const date = String(observation.obsDt || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  const parts = date.split('-').map(Number);
  const record = {
    species: normalizeName(observation.comName),
    latin: observation.sciName || '',
    speciesCode: observation.speciesCode || '',
    year: parts[0],
    month: parts[1],
    date,
    notable: notable.has(String(observation.speciesCode || observation.comName) + '|' + date),
    hotspot: observation.locName || target.name,
    hotspotId: hotspot.locId,
    checklistId: observation.subId || null,
    howMany: observation.howMany !== null && observation.howMany !== undefined && observation.howMany !== '' && Number.isFinite(Number(observation.howMany)) ? Number(observation.howMany) : null
  };
  recordsByKey.set(recordKey(record), record);
  accepted++;
}
feed = {
  source: 'eBird',
  hotspotName: hotspot.name || hotspot.locName || target.name,
  hotspotId: hotspot.locId,
  updatedAt: new Date().toISOString(),
  records: [...recordsByKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.species.localeCompare(b.species)),
  lastRunNewReports: accepted
};
await fs.writeFile(outputPath, JSON.stringify(feed, null, 2) + '\n');
console.log('Saved ' + feed.records.length + ' retained reports for ' + feed.hotspotName + ' (' + accepted + ' accepted from the latest 30-day query).');
