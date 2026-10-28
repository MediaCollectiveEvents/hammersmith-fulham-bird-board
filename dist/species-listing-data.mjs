import {displayName} from './bird-cards-data.mjs';
export function completeSpeciesListing(lookup,facts,latest,rankings=new Map(),places=new Map(),nicknames=new Map()){
 return lookup.rows.map(item=>{
  const f=facts.get(item.scientificName)?.fields||{},report=latest.get(item.scientificName),rank=rankings.get(item.scientificName);
  return {scientificName:item.scientificName,commonName:item.commonName,displayName:displayName(item.commonName,item.scientificName),boroughRank:item.rank,historicalRecords:item.records,lastRecordedInArchive:item.lastRecorded||null,firstRecordedInArchive:rank?.firstRecorded||null,recentRank:rank?.rank??null,recentRecords:rank?.records??null,recentWindowStart:rank?.start||null,recentWindowEnd:rank?.end||null,historicalNicknames:nicknames.get(item.scientificName)||f.historicalNames?.value||[],nicknameSource:nicknames.has(item.scientificName)?'Supplied workbook; not independently source-checked':f.historicalNames?'Verified dictionary entries':null,publicPlaces:places.get(item.scientificName)||[],latestPublicReportDate:report?.date||null,latestPublicLocations:report?.locations||[],locationFeedUpdatedAt:report?.feedUpdatedAt||null,ukConservation:f.conservation?`${f.conservation.value} · ${f.conservation.assessment}`:null,weightGrams:f.weightGrams?.value??null,typicalLifespanYears:f.typicalLifespanYears?.value??null,identification:f.identification?.value||null,diet:f.diet?.value||null,habitat:f.habitat?.value||null,fact:f.memorableFact?.value||null,verification:'Only verified factfile fields included; blank values are unavailable or awaiting review'};
 });
}
const columns=['boroughRank','commonName','scientificName','historicalNicknames','nicknameSource','publicPlaces','historicalRecords','firstRecordedInArchive','lastRecordedInArchive','recentRank','recentRecords','recentWindowStart','recentWindowEnd','latestPublicReportDate','latestPublicLocations','locationFeedUpdatedAt','ukConservation','weightGrams','typicalLifespanYears','identification','diet','habitat','fact','verification'];
export function listingCSV(rows){
 const cell=value=>'"'+String(Array.isArray(value)?value.map(v=>typeof v==='object'?`${v.name} (${v.lastReported})`:v).join('; '):value??'').replace(/"/g,'""')+'"';
 return [columns,...rows.map(row=>columns.map(key=>row[key]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
