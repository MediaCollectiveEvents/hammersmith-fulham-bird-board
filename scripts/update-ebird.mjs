const apiKey = process.env.EBIRD_API_KEY;
if (!apiKey) throw new Error('Set EBIRD_API_KEY in the GitHub Actions repository secrets.');

const apiRoot = 'https://api.ebird.org/v2';
const boundaryUrl = 'https://www.planning.data.gov.uk/entity/8600296.geojson';
const outputPath = new URL('../dist/data/observations.json', import.meta.url);

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

const polygons = coordinatesFromBoundary(await getJson(boundaryUrl));
// Search a wide enough radius to cover the borough, then require the hotspot's
// coordinates to fall inside the exact borough boundary. eBird's notable endpoint
// lets the board omit rare/unusual records while retaining regular local species.
const params = new URLSearchParams({lat: '51.49', lng: '-0.23', dist: '10', back: '30', hotspot: 'true', includeProvisional: 'false', maxResults: '10000'});
const headers = {'X-eBirdApiToken': apiKey};
const observationsUrl = new URL(`${apiRoot}/data/obs/geo/recent`);
observationsUrl.search = params;
const notableUrl = new URL(`${apiRoot}/data/obs/geo/recent/notable`);
notableUrl.search = params;
const [observations, notableObservations] = await Promise.all([
  getJson(observationsUrl, headers),
  getJson(notableUrl, headers)
]);
const observationKey = observation => `${observation.comName}|${observation.locId}|${String(observation.obsDt).slice(0, 10)}`;
const notableKeys = new Set(notableObservations.map(observationKey));

const fs = await import('node:fs/promises');
let feed;
try { feed = JSON.parse(await fs.readFile(outputPath, 'utf8')); }
catch { feed = {source: 'eBird', updatedAt: null, records: []}; }
// Use the hotspot ID consistently so old records keyed by hotspot name are
// normalised and repeated daily runs replace, rather than duplicate, reports.
const recordKey = record => `${record.species}|${record.date}|${record.hotspotId || record.hotspot}`;
const byId = new Map(feed.records.map(record => [recordKey(record), record]));
let accepted = 0;

for (const observation of observations) {
  if (!observation.locId || !Number.isFinite(Number(observation.lat)) || !Number.isFinite(Number(observation.lng))) continue;
  if (observation.obsValid !== true || notableKeys.has(observationKey(observation))) continue;
  if (!inBorough(Number(observation.lng), Number(observation.lat), polygons)) continue;
  const date = String(observation.obsDt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  const [year, month] = date.split('-').map(Number);
  const record = {species: observation.comName, latin: observation.sciName || '', speciesCode: observation.speciesCode || '', year, month, date, hotspot: observation.locName, hotspotId: observation.locId, checklistId: observation.subId || null};
  byId.set(recordKey(record), record);
  accepted++;
}

const records = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.species.localeCompare(b.species));
feed = {source: 'eBird', updatedAt: new Date().toISOString(), records, lastRunNewReports: accepted};
await fs.writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Saved ${records.length} retained non-notable hotspot reports (${accepted} accepted from the latest 30-day query).`);
