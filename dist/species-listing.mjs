import {publicSpeciesPlaces,workbookNicknames} from './bird-places.mjs';
import {createSpeciesLookup,escapeHTML as e} from './bird-cards-data.mjs';
import {validateFacts} from './bird-facts.mjs';
import {latestPublicReports,reconcileCardRankings} from './bird-card-context.mjs';
import {validateRankings,verifyRelease} from './bird-rankings-data.mjs';
import {completeSpeciesListing,listingCSV} from './species-listing-data.mjs';
const read=async name=>{const r=await fetch(`./data/${name}`,{cache:'no-store'});if(!r.ok)throw Error('Public data unavailable');return r.text();};
let rows=[];
const search=document.querySelector('#listing-search'),sort=document.querySelector('#listing-sort'),status=document.querySelector('#listing-status');
function render(){
 const query=search.value.trim().toLowerCase();const selected=rows.filter(r=>`${r.commonName} ${r.displayName} ${r.scientificName} ${r.historicalNicknames.join(' ')}`.toLowerCase().includes(query));
 selected.sort(sort.value==='name'?(a,b)=>a.displayName.localeCompare(b.displayName):sort.value==='latest'?(a,b)=>(b.latestPublicReportDate||'').localeCompare(a.latestPublicReportDate||'')||a.boroughRank-b.boroughRank:(a,b)=>a.boroughRank-b.boroughRank);
 document.querySelector('#listing-rows').innerHTML=selected.map(r=>`<tr><td>${r.boroughRank}</td><td><button type="button" class="bird-species-trigger" data-bird-species="${e(r.scientificName)}" aria-haspopup="dialog">${e(r.displayName)}</button><small><i>${e(r.scientificName)}</i></small></td><td>${e(r.historicalNicknames.join(', ')||'Unavailable')}<small>${e(r.nicknameSource||'')}</small></td><td>${r.historicalRecords.toLocaleString('en-GB')}</td><td>${e(r.lastRecordedInArchive||'Unavailable')}</td><td>${e(r.latestPublicReportDate||'No public report in loaded feeds')}</td><td>${r.publicPlaces.length?`<details><summary>${r.publicPlaces.length} public hotspot(s)</summary><ul>${r.publicPlaces.map(p=>`<li>${e(p.name)} · ${e(p.lastReported)}</li>`).join('')}</ul></details>`:'Unavailable'}${r.locationFeedUpdatedAt?`<small>Snapshot ${e(r.locationFeedUpdatedAt)}</small>`:''}</td><td>${r.recentRecords===null?'Unavailable':r.recentRank===null?'Unranked':r.recentRank}${r.recentWindowEnd?`<small>${e(r.recentWindowStart)}–${e(r.recentWindowEnd)}</small>`:''}</td><td>${e(r.ukConservation||'Awaiting verification')}</td></tr>`).join('')||'<tr><td colspan="9">No matching taxa.</td></tr>';
 status.textContent=`${selected.length} of ${rows.length} taxa · ${rows.filter(r=>r.latestPublicReportDate).length} with a public-hotspot report · ${rows.filter(r=>r.historicalNicknames.length).length} with historical nicknames (see source labels).`;
}
try{
 const lookup=createSpeciesLookup(JSON.parse(await read('ebird-history.json')));let facts=new Map(),ranks=new Map(),nicknames=new Map();try{nicknames=workbookNicknames(JSON.parse(await read('bird-nicknames.json')),lookup);}catch{}
 const results=await Promise.allSettled(['bird-facts.json','observations.json','wetland-centre-observations.json'].map(read));
 if(results[0].status==='fulfilled')try{facts=validateFacts(JSON.parse(results[0].value),lookup);}catch{}
 const feeds=results.slice(1).filter(r=>r.status==='fulfilled').flatMap(r=>{try{return [JSON.parse(r.value)];}catch{return [];}});
 try{const [raw,meta,calendar]=await Promise.all(['bird-rankings.json','seasonality_metadata.json','species_migration_calendar.csv'].map(read));const data=validateRankings(JSON.parse(raw));await verifyRelease(data,meta,calendar);ranks=reconcileCardRankings(data,lookup);}catch{}
 rows=completeSpeciesListing(lookup,facts,latestPublicReports(feeds,lookup),ranks,publicSpeciesPlaces(feeds,lookup),nicknames);render();document.querySelector('#listing-export').disabled=false;
}catch{status.textContent='The validated species list is unavailable. Please try again later.';}
search.addEventListener('input',render);sort.addEventListener('change',render);
document.querySelector('#listing-export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([listingCSV(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='hf-complete-species-listing.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
