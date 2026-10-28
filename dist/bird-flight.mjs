import {escapeHTML as e,ambiguousTaxon} from './bird-cards-data.mjs';
export function validateFlightOutlines(data,lookup){
 if(data.schemaVersion!==1||!Array.isArray(data.outlines))throw Error('Invalid flight catalogue');
 const output=new Map(),sources=new Set();
 for(const row of data.outlines){
  if(!lookup.resolve('',row.scientificName)||ambiguousTaxon(row.scientificName)||output.has(row.scientificName)||sources.has(row.sourcePage)||row.verificationStatus!=='verified')throw Error('Invalid flight identity');
  if(!/^\.\/images\/flight\/[a-z-]+\.svg$/.test(row.imagePath)||!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(row.sourcePage)||row.licence!=='CC BY-SA 3.0'||row.licenceUrl!=='https://creativecommons.org/licenses/by-sa/3.0/'||!row.creator||!row.sourceTitle||!row.modifications||!Number.isInteger(row.width)||row.width<=0||!Number.isInteger(row.height)||row.height<=0)throw Error('Incomplete flight rights/asset');
  output.set(row.scientificName,row);sources.add(row.sourcePage);
 }
 return output;
}
export function flightMarkup(outline,name){
 if(!outline)return '';
 return `<section class="bird-flight" aria-label="In flight"><h3>In flight</h3><figure><div class="bird-flight-panel"><img src="${e(outline.imagePath)}" width="${outline.width}" height="${outline.height}" alt="${e(name)} flight silhouette" loading="lazy" decoding="async"></div><figcaption>Illustrative flight shape; pose and perspective vary. Not to scale.</figcaption></figure><p class="bird-flight-credit">${e(outline.creator)} · <a href="${e(outline.sourcePage)}" target="_blank" rel="noreferrer">Commons source</a> · <a href="${e(outline.licenceUrl)}" target="_blank" rel="noreferrer">${e(outline.licence)}</a>. ${e(outline.modifications)}</p></section>`;
}
