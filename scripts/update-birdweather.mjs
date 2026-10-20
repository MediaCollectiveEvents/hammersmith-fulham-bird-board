const endpoint = 'https://app.birdweather.com/graphql';
const boundaryUrl = 'https://www.planning.data.gov.uk/entity/8600296.geojson';
const outputPath = new URL('../dist/data/birdweather.json', import.meta.url);
const confidenceThreshold = 0.7;
const maxPages = 10;

async function getJson(url, options = {}) {
  const response = await fetch(url, {...options, signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`${response.status} from ${url}: ${await response.text()}`);
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
const query = `query BoroughDetections($first: Int!, $after: String, $period: InputDuration!, $confidenceGte: Float!, $ne: InputLocation!, $sw: InputLocation!) {
  detections(first: $first, after: $after, period: $period, confidenceGte: $confidenceGte, ne: $ne, sw: $sw) {
    nodes { id confidence certainty timestamp coords { lat lon } species { commonName scientificName ebirdCode } station { id name } }
    pageInfo { hasNextPage endCursor }
  }
}`;
const all = new Map();
let after = null, hasNextPage = true, pages = 0;
while (hasNextPage && pages < maxPages) {
  const payload = {query, variables: {
    first: 250, after, period: {count: 24, unit: 'hour'}, confidenceGte: confidenceThreshold,
    ne: {lat: 51.55, lon: -0.14}, sw: {lat: 51.45, lon: -0.32}
  }};
  const result = await getJson(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  if (result.errors?.length) throw new Error('BirdWeather GraphQL error: ' + result.errors.map(e => e.message).join('; '));
  const connection = result.data?.detections;
  if (!connection?.pageInfo) throw new Error('BirdWeather response did not include detections.pageInfo.');
  for (const detection of connection.nodes || []) {
    const lat = Number(detection.coords?.lat), lon = Number(detection.coords?.lon);
    if (!detection.id || !Number.isFinite(lat) || !Number.isFinite(lon) || !inBorough(lon, lat, polygons)) continue;
    const species = detection.species || {};
    const record = {
      id: String(detection.id), species: species.commonName || 'Unknown bird', latin: species.scientificName || '',
      ebirdCode: species.ebirdCode || '', timestamp: detection.timestamp,
      confidence: Number(detection.confidence || 0), certainty: detection.certainty ?? null,
      station: detection.station?.name || 'BirdWeather station', stationId: detection.station?.id ? String(detection.station.id) : null
    };
    all.set(record.id, record);
  }
  hasNextPage = Boolean(connection.pageInfo.hasNextPage);
  after = connection.pageInfo.endCursor || null;
  if (hasNextPage && !after) throw new Error('BirdWeather pagination indicated more results without an end cursor.');
  pages++;
}
const records = [...all.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
const feed = {
  source: 'BirdWeather', updatedAt: new Date().toISOString(), periodHours: 24,
  confidenceThreshold, recordCount: records.length, truncated: hasNextPage, records
};
const fs = await import('node:fs/promises');
await fs.writeFile(outputPath, JSON.stringify(feed, null, 2) + '\n');
console.log(`Saved ${records.length} in-borough BirdWeather detections from the last 24 hours (confidence ≥ ${confidenceThreshold}; truncated=${hasNextPage}).`);
