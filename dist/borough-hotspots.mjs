// Official eBird identity and mapped coordinates, verified 31 October 2026:
// https://ebird.org/hotspot/L939893 (Directions link).
export const requiredBoroughHotspots = [
  {locId: 'L939893', name: 'Ravenscourt Park', lat: 51.4966678, lng: -0.2383518}
];
const excludedIds = new Set(['L12107155', 'L939896']);
export function isExcludedBoroughLocation(location) {
  const id = location.locId || location.hotspotId;
  const name = String(location.name || location.locName || location.hotspot || '');
  return excludedIds.has(id) || /kensal green|(?:WWT\s+)?London Wetland Centre/i.test(name);
}

// Apply to retained snapshots too: previously accepted outside-borough records
// must not survive indefinitely or affect the board's species/observer totals.
export function sanitizeBoroughFeed(feed) {
  const hotspots = new Map(requiredBoroughHotspots.map(h => [h.locId, {...h}]));
  for (const h of feed.hotspots || []) {
    if (h?.locId && !isExcludedBoroughLocation(h)) hotspots.set(h.locId, h);
  }
  const records = new Map();
  for (const original of feed.records || []) {
    if (isExcludedBoroughLocation(original)) continue;
    const required = requiredBoroughHotspots.find(h => h.locId === original.hotspotId ||
      (!original.hotspotId && h.name === original.hotspot));
    const record = required ? {...original, hotspotId: required.locId, hotspot: required.name, reportType: 'hotspot'} : original;
    const key = `${record.species}|${record.date}|${record.hotspotId || record.hotspot}|${record.checklistId || ''}`;
    records.set(key, record);
  }
  return {...feed, hotspots: [...hotspots.values()], records: [...records.values()]};
}
