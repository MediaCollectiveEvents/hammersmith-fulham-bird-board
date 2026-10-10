const apiKey = process.env.EBIRD_API_KEY;
if (!apiKey) throw new Error('Set EBIRD_API_KEY in the GitHub Actions repository secrets.');

const apiRoot = 'https://api.ebird.org/v2';
const boundaryUrl = 'https://www.planning.data.gov.uk/entity/8600296.geojson';
const outputPath = new URL('../dist/data/observations.json', import.meta.url);
const targetSpecies = new Set([
  'Sand Martin', 'Swallow', 'House Martin', 'Common Swift', 'Common Whitethroat',
  'Redwing', 'Fieldfare', 'Brambling', 'Siskin'
]);

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
// Recent geospatial results cover the borough; exact polygon filtering below removes nearby out-of-borough records.
const url = new URL(`${apiRoot}/data/obs/geo/recent`);
url.search = new URLSearchParams({lat: '51.49', lng: '-0.23', dist: '10', back: '30', hotspot: 'true', includeProvisional: 'false'});
const observations = await getJson(url, {'X-eBirdApiToken': apiKey});

const fs = await import('node:fs/promises');
let feed;
try { feed = JSON.parse(await fs.readFile(outputPath, 'utf8')); }
catch { feed = {source: 'eBird', updatedAt: null, records: []}; }
const byId = new Map(feed.records.map(record => [`${record.species}|${record.date}|${record.hotspot}`, record]));
let accepted = 0;

for (const observation of observations) {
  if (!targetSpecies.has(observation.comName) || !observation.locId || !observation.lat || !observation.lng) continue;
  if (!inBorough(Number(observation.lng), Number(observation.lat), polygons)) continue;
  const date = String(observation.obsDt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  const [year, month] = date.split('-').map(Number);
  const record = {species: observation.comName, year, month, date, hotspot: observation.locName, hotspotId: observation.locId, checklistId: observation.subId || null};
  byId.set(`${record.species}|${record.date}|${record.hotspotId}`, record);
  accepted++;
}

const records = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.species.localeCompare(b.species));
feed = {source: 'eBird', updatedAt: new Date().toISOString(), records, lastRunNewReports: accepted};
await fs.writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Saved ${records.length} retained reports (${accepted} accepted from the latest 30-day query).`);
