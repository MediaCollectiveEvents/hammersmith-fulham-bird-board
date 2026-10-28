import {latestPublicReports} from './bird-card-context.mjs';
import {escapeHTML as e} from './bird-cards-data.mjs';
export function publicSpeciesPlaces(feeds,lookup){
 const output=new Map();
 for(const feed of feeds)for(const record of feed?.records||[]){
  const accepted=latestPublicReports([{...feed,records:[record]}],lookup);
  for(const [key,value] of accepted){
   const places=output.get(key)||new Map();
   for(const name of value.locations){const previous=places.get(name);if(!previous||value.date>previous.lastReported)places.set(name,{name,lastReported:value.date});}
   output.set(key,places);
  }
 }
 return new Map([...output].map(([key,places])=>[key,[...places.values()].sort((a,b)=>b.lastReported.localeCompare(a.lastReported)||a.name.localeCompare(b.name))]));
}
export function workbookNicknames(data,lookup){
 if(data.schemaVersion!==1||data.status!=='workbook-supplied'||!Array.isArray(data.taxa))throw Error('Invalid nickname catalogue');
 const output=new Map();
 for(const row of data.taxa){const item=lookup.resolve('',row.scientificName);if(!item||item.commonName!==row.commonName||output.has(row.scientificName)||!Array.isArray(row.names)||row.names.some(n=>typeof n!=='string'||!n.trim()))throw Error('Invalid nickname identity');output.set(row.scientificName,row.names);}
 return output;
}
export function placesMarkup(places=[]){return `<details class="bird-reports"><summary>Places reported (${places.length})</summary><p>Public hotspots in the loaded eBird feeds, with the latest report at each. This is not a complete historical distribution.</p>${places.length?`<ul>${places.map(p=>`<li>${e(p.name)} · ${e(p.lastReported)}</li>`).join('')}</ul>`:'<p>No matching public hotspots in the loaded feeds.</p>'}</details>`;}
export function namesMarkup(names=[]){return names.length?`<p class="bird-workbook-names"><strong>Historical nicknames:</strong> ${e(names.join(', '))}<br><small>From the supplied workbook; not independently source-checked or confirmed as local usage.</small></p>`:'';}
