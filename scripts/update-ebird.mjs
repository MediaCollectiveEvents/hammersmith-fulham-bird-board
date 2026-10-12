const apiKey = process.env.EBIRD_API_KEY;
if (!apiKey) throw new Error('Set EBIRD_API_KEY in the GitHub Actions repository secrets.');

const apiRoot = 'https://api.ebird.org/v2';
const boundaryUrl = 'https://www.planning.data.gov.uk/entity/8600296.geojson';
const outputPath = new URL('../dist/data/observations.json', import.meta.url);
const excludedHotspotIds = new Set(['L12107155']); // St Mary's Catholic Cemetery (Kensal Green), outside the borough
const explicitlyIncludedHotspotNames = new Set(['Hammersmith (LBC District)', 'Furnival Gardens', 'Furnivall Gardens', 'Hammersmith Cemetery / Magravine Cemetery', 'Magravine Cemetery']); // Keep these borough hotspots in refreshes even without a recent checklist; accept common Furnivall spellings.

async function getJson(url, headers = {}) {
  const response = await fetch(url, {headers, signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`${response.status} from ${url.split('?')[0]}: ${await response.text()}`);
  return response.json();
}

function coordinatesFromBoundary(value) {
  const geometry = value.type === 'Feature' ? value.geometry : value.type === 'FeatureCollection' ? value.features[0]?.geometry : value;
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error('Boundary response did not contain polygon geometry.');
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function insideRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insidePolygon(point, polygon) {
  return insideRing(point, polygon[0]) && !polygon.slice(1).some(hole => insideRing(point, hole));
}

function inBorough(lon, lat, polygons) {
  return polygons.some(polygon => insidePolygon([lon, lat], polygon));
}

// Keep eBird common names consistent with British English on the board.
function normalizeCommonName(name, latin = '') {
  if (latin === 'Motacilla alba') return 'Pied Wagtail';
  return String(name || '').replace(/^(?:Eurasian|European)\s+/i, '').replace(/^Gray(?=\s)/i, 'Grey');
}

const polygons = coordinatesFromBoundary(await getJson(boundaryUrl));
// Discover hotspots with recent activity near the borough, then keep only
// hotspots whose mapped coordinates fall inside the exact borough boundary.
// Query each hotspot's location feed so multiple checklists/reports are retained;
// the nearby geo endpoint returns only the latest report per species.
const headers = {'X-eBirdApiToken': apiKey};
const hotspotUrl = new URL(`${apiRoot}/ref/hotspot/geo`);
hotspotUrl.search = new URLSearchParams({lat: '51.49', lng: '-0.23', dist: '10', back: '30', fmt: 'json'});
const nearbyHotspots = await getJson(hotspotUrl, headers);
// Also look up configured hotspots without the recent-activity filter so the
// target location is queried even when its last checklist was more than 30 days ago.
const allHotspotUrl = new URL(`${apiRoot}/ref/hotspot/geo`);
allHotspotUrl.search = new URLSearchParams({lat: '51.49', lng: '-0.23', dist: '10', fmt: 'json'});
const allNearbyHotspots = await getJson(allHotspotUrl, headers);
const recentHotspotIds = new Set(nearbyHotspots.map(h => h.locId));
const hotspotCandidates = new Map([...allNearbyHotspots, ...nearbyHotspots].map(h => [h.locId, h]));
const boroughHotspots = [...hotspotCandidates.values()].filter(h => {
  const name = String(h.name || h.locName || '');
  return h.locId && !excludedHotspotIds.has(h.locId) && !/kensal green/i.test(name) && Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lng)) && inBorough(Number(h.lng), Number(h.lat), polygons) && (recentHotspotIds.has(h.locId) || explicitlyIncludedHotspotNames.has(name));
});

async function mapLimit(items, limit, callback) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await callback(items[index]);
    }
  }));
  return output;
}

const hotspotResults = await mapLimit(boroughHotspots, 2, async hotspot => {
  const params = new URLSearchParams({back: '30', includeProvisional: 'false', maxResults: '10000', detail: 'full'});
  const observationsUrl = new URL(`${apiRoot}/data/obs/${encodeURIComponent(hotspot.locId)}/recent`);
  observationsUrl.search = params;
  const notableUrl = new URL(`${apiRoot}/data/obs/${encodeURIComponent(hotspot.locId)}/recent/notable`);
  notableUrl.search = params;
  const [observations, notableObservations] = await Promise.all([
    getJson(observationsUrl, headers),
    getJson(notableUrl, headers)
  ]);
  const notableKeys = new Set(notableObservations.map(observation => `${observation.comName}|${String(observation.obsDt).slice(0, 10)}`));
  return {observations, notableKeys};
});
const observations = hotspotResults.flatMap(result => result.observations);
const notableByLocation = new Map(boroughHotspots.map((hotspot, index) => [hotspot.locId, hotspotResults[index].notableKeys]));

const fs = await import('node:fs/promises');
let feed;
try { feed = JSON.parse(await fs.readFile(outputPath, 'utf8')); }
catch { feed = {source: 'eBird', updatedAt: null, records: []}; }
// Use the hotspot ID consistently so old records keyed by hotspot name are
// normalised and repeated daily runs replace, rather than duplicate, reports.
const recordKey = record => `${record.species}|${record.date}|${record.hotspotId || record.hotspot}|${record.checklistId || ''}`;
const byId = new Map(feed.records.filter(record => !excludedHotspotIds.has(record.hotspotId) && !/kensal green/i.test(record.hotspot || '')).map(record => {
  const normalized = {...record, species: normalizeCommonName(record.species, record.latin)};
  return [recordKey(normalized), normalized];
}));
let accepted = 0;

for (const observation of observations) {
  if (!observation.locId || excludedHotspotIds.has(observation.locId) || /kensal green/i.test(observation.locName || '') || !Number.isFinite(Number(observation.lat)) || !Number.isFinite(Number(observation.lng))) continue;
  if (observation.obsValid !== true) continue;
  if (!inBorough(Number(observation.lng), Number(observation.lat), polygons)) continue;
  const date = String(observation.obsDt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  const [year, month] = date.split('-').map(Number);
  const notable = notableByLocation.get(observation.locId)?.has(`${observation.comName}|${date}`) === true;
  const record = {species: normalizeCommonName(observation.comName, observation.sciName), latin: observation.sciName || '', speciesCode: observation.speciesCode || '', year, month, date, notable, hotspot: observation.locName, hotspotId: observation.locId, checklistId: observation.subId || null, observer: observation.userDisplayName || null, howMany: observation.howMany !== null && observation.howMany !== undefined && observation.howMany !== '' && Number.isFinite(Number(observation.howMany)) ? Number(observation.howMany) : null};
  byId.set(recordKey(record), record);
  accepted++;
}

const records = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.species.localeCompare(b.species));
feed = {source: 'eBird', updatedAt: new Date().toISOString(), records, lastRunNewReports: accepted};
await fs.writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Saved ${records.length} retained hotspot reports, including notable records (${accepted} accepted from ${boroughHotspots.length} in-borough hotspots in the latest 30-day query).`);
