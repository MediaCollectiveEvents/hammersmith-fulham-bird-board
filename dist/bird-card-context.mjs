import {escapeHTML as e} from './bird-cards-data.mjs';
const date=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
// Extract only public display fields. Never pass observation objects to the card.
export function latestPublicReports(feeds,lookup){
 const byTaxon=new Map();
 for(const feed of feeds){
  if(feed?.source!=='eBird' || !Array.isArray(feed.records) || !Number.isFinite(Date.parse(feed.updatedAt)))continue;
  const directory=new Map((feed.hotspots||[]).map(h=>[h.locId,h.name]));
  if(feed.hotspotId && feed.hotspotName)directory.set(feed.hotspotId,feed.hotspotName);
  for(const record of feed.records){
   const item=lookup.resolve('',record.latin),location=directory.get(record.hotspotId);
   if(!item || !location || !date(record.date) || record.date>feed.updatedAt.slice(0,10) || (record.reportType && record.reportType!=='hotspot'))continue;
   const existing=byTaxon.get(item.scientificName);
   if(!existing || record.date>existing.date)byTaxon.set(item.scientificName,{date:record.date,locations:[location],feedUpdatedAt:feed.updatedAt});
   else if(record.date===existing.date){if(!existing.locations.includes(location))existing.locations.push(location);existing.locations.sort();existing.feedUpdatedAt=[existing.feedUpdatedAt,feed.updatedAt].sort()[0];}
  }
 }
 return byTaxon;
}
export function reconcileCardRankings(data,lookup){
 if(data.rankings.borough.length!==lookup.rows.length)throw Error('Archive/rank mismatch');
 const result=new Map();
 for(const row of data.rankings.borough){
  const item=lookup.resolve('',row.scientificName);
  if(!item || item.commonName!==row.commonName || item.records!==row.records || item.lastRecorded!==row.lastRecorded || item.rank!==row.rank)throw Error('Archive/rank mismatch');
  const recent=data.rankings.recent.find(r=>r.commonName===row.commonName);
  result.set(row.scientificName,{rank:recent.recentRank,records:recent.records,start:data.recentWindow.start,end:data.recentWindow.end,firstRecorded:row.firstRecorded});
 }
 return result;
}
export function contextMarkup(item,recent,latest){
 if(!item)return '';
 return `<details class="bird-reports"><summary>Borough reporting details</summary>${recent?`<p>First recorded in archive: <strong>${e(recent.firstRecorded)}</strong></p><p>Recent reporting rank: <strong>${recent.rank===null?'Unranked (no records)':recent.rank}</strong> · ${recent.records.toLocaleString('en-GB')} observation records</p><p>Archive window: ${e(recent.start)}–${e(recent.end)} (365 days). Reporting position, not abundance or population trend.</p>`:'<p>Recent reporting rank unavailable: a matching validated archive release is required.</p>'}${latest?`<p>Latest report in our eBird feeds: <strong>${e(latest.locations.join('; '))}</strong> · <time datetime="${e(latest.date)}">${e(latest.date)}</time></p><p>Feed snapshot updated ${e(latest.feedUpdatedAt)}. Public hotspots only; the feeds are incomplete and this is not necessarily the latest borough sighting.</p>`:'<p>No matching public-hotspot report is available in the loaded eBird feeds. This does not establish absence.</p>'}</details>`;
}
