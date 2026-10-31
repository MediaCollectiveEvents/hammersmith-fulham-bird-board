import {validateFlightOutlines,flightMarkup} from './bird-flight.mjs';
import {publicSpeciesPlaces,workbookNicknames,placesMarkup,namesMarkup} from './bird-places.mjs';
import {latestPublicReports,reconcileCardRankings,contextMarkup} from './bird-card-context.mjs';
import {validateRankings,verifyRelease} from './bird-rankings-data.mjs';
import {validateFacts,factsMarkup} from './bird-facts.mjs';
import {createSpeciesLookup, validateImages, cardMarkup} from './bird-cards-data.mjs';
const dialog=document.createElement('dialog');
dialog.className='bird-card';
dialog.setAttribute('aria-labelledby','bird-card-title');
dialog.innerHTML='<button type="button" class="bird-card-close" aria-label="Close species card">Close ×</button><div class="bird-card-content" aria-live="polite"></div>';
document.body.append(dialog);
const content=dialog.querySelector('.bird-card-content');
let opener, lookup, photos=new Map(), facts=new Map(), recentRanks=new Map(), latestReports=new Map(), places=new Map(),nicknames=new Map(),outlines=new Map(), loading;
function read(name) { return fetch(`./data/${name}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}); }
async function load() {
  lookup=createSpeciesLookup(await read('ebird-history.json'));try{nicknames=workbookNicknames(await read('bird-nicknames.json'),lookup);}catch{}
  try{outlines=validateFlightOutlines(await read('bird-flight-outlines.json'),lookup);}catch{outlines=new Map();}
  try {facts=validateFacts(await read('bird-facts.json'),lookup);} catch {facts=new Map();}
  try {photos=validateImages(await read('bird-images.json'),lookup);} catch {photos=new Map();}
  await Promise.allSettled([
    (async()=>{const feeds=await Promise.allSettled(['observations.json','wetland-centre-observations.json'].map(read));const loaded=feeds.filter(r=>r.status==='fulfilled').map(r=>r.value);latestReports=latestPublicReports(loaded,lookup);places=publicSpeciesPlaces(loaded,lookup);})(),
    (async()=>{const text=async name=>{const r=await fetch(`./data/${name}`,{cache:'no-store'});if(!r.ok)throw Error('Missing release');return r.text();};const [raw,meta,calendar]=await Promise.all(['bird-rankings.json','seasonality_metadata.json','species_migration_calendar.csv'].map(text));const data=validateRankings(JSON.parse(raw));await verifyRelease(data,meta,calendar);recentRanks=reconcileCardRankings(data,lookup);})()
  ]);
}
function decorate() {
  if(!lookup)return;
  document.querySelectorAll('a.bird-detail-link,.rankings-name').forEach(el=>{
    if(el.dataset.cardDecorated)return;
    const item=lookup.resolve(el.textContent.trim());
    if(!item)return;
    const button=document.createElement('button');
    button.type='button';button.className='bird-species-trigger';button.textContent=el.textContent;
    button.dataset.birdSpecies=item.scientificName;button.setAttribute('aria-haspopup','dialog');
    el.dataset.cardDecorated='true';
    if(el.matches('a')) {el.before(button);el.textContent=' ↗';el.setAttribute('aria-label',`Search RSPB for ${button.textContent} (opens a new tab)`);}
    else el.replaceWith(button);
  });
}
async function open(button) {
  opener=button;content.innerHTML='<h2 id="bird-card-title">Loading species information…</h2>';
  dialog.showModal();document.documentElement.classList.add('bird-card-open');dialog.querySelector('button').focus();
  try {await (loading ||= load());if(!dialog.open)return;const item=lookup.resolve(button.dataset.birdSpecies);content.innerHTML=cardMarkup(item,photos.get(item?.scientificName));content.querySelector('#bird-card-title + p')?.insertAdjacentHTML('afterend',namesMarkup(nicknames.get(item?.scientificName)));content.querySelector('.bird-card-stats')?.insertAdjacentHTML('afterend',factsMarkup(facts.get(item?.scientificName))+flightMarkup(outlines.get(item?.scientificName),item?.commonName)+contextMarkup(item,recentRanks.get(item?.scientificName),latestReports.get(item?.scientificName))+placesMarkup(places.get(item?.scientificName)));const flightImage=content.querySelector('.bird-flight img');if(flightImage)flightImage.addEventListener('error',()=>content.querySelector('.bird-flight')?.remove());const img=content.querySelector('.bird-card-photo img');if(img)img.addEventListener('error',()=>{img.hidden=true;const message=content.querySelector('.bird-image-failure');if(message)message.hidden=false;});document.dispatchEvent(new CustomEvent('bird-card-rendered',{detail:{scientificName:item?.scientificName}}));}
  catch {loading=null;content.innerHTML='<h2 id="bird-card-title">Species information unavailable</h2><p>Close and try again when the archive is available.</p>';}
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-bird-species]');if(button)open(button);});
dialog.querySelector('.bird-card-close').addEventListener('click',()=>dialog.close());
// Native modal dialog supplies Escape and background inertness.
dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button,a[href],summary')].filter(el=>!el.disabled && el.checkVisibility());
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
});
dialog.addEventListener('close',()=>{document.documentElement.classList.remove('bird-card-open');if(opener?.isConnected)opener.focus({preventScroll:true});});
new MutationObserver(decorate).observe(document.querySelector('main') || document.body,{childList:true,subtree:true});
loading=load();loading.then(decorate).catch(()=>{loading=null;});
