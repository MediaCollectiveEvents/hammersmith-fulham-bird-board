import {ambiguousTaxon,escapeHTML as e} from './bird-cards-data.mjs';
const allowed=new Set(['weightGrams','typicalLifespanYears','ringedLongevity','historicalNames','identification','diet','habitat','memorableFact','bodyLength','wingspan','breeding','clutchSize','call','conservation']);
const safeURL=value=>typeof value==='string' && /^https:\/\/(www\.bto\.org\/learn\/about-birds\/birdfacts\/[a-z-]+|archive\.org\/details\/dictionaryofengl00swanrich|www\.rspb\.org\.uk\/birds-and-wildlife\/[a-z-]+)$/.test(value);
export function validateFacts(data,lookup) {
  if(data.schemaVersion!==1 || !Array.isArray(data.profiles))throw Error('Invalid facts catalogue');
  const result=new Map();
  for(const profile of data.profiles){
    const item=lookup.resolve(profile.scientificName);
    if(!item || item.commonName!==profile.commonName || result.has(profile.scientificName) || !profile.fields || Array.isArray(profile.fields))throw Error('Invalid fact identity');
    for(const [key,field] of Object.entries(profile.fields)){
      if(!allowed.has(key) || ambiguousTaxon(profile.scientificName) || field.status!=='verified' || !safeURL(field.sourceUrl) || !field.sourceTitle || !field.sourceSection || !/^\d{4}-\d{2}-\d{2}$/.test(field.checkedOn))throw Error('Unverified fact');
      if(['weightGrams','typicalLifespanYears'].includes(key) && (typeof field.value!=='number' || !Number.isFinite(field.value) || field.value<=0))throw Error('Invalid measurement');
      if(key==='conservation' && (!['Red','Amber','Green'].includes(field.value) || field.assessment!=='BoCC5 (2021)' || field.assessmentUrl!=='https://www.bto.org/sites/default/files/publications/bocc-5-a5-4pp-single-pages.pdf'))throw Error('Unverified conservation assessment');
      if(!['weightGrams','typicalLifespanYears','historicalNames'].includes(key) && (typeof field.value!=='string'||!field.value.trim()))throw Error('Missing fact text');
      if(key==='ringedLongevity' && (typeof field.value!=='string' || !field.value.trim()))throw Error('Missing longevity');
      if(key==='historicalNames' && (!Array.isArray(field.value) || !field.value.length || field.value.some(n=>typeof n!=='string'||!n.trim())))throw Error('Invalid historical names');
    }
    for(const guide of [profile.referenceGuide,profile.soundGuide])if(guide && (!safeURL(guide.url)||!guide.title))throw Error('Unsafe guide');
    result.set(profile.scientificName,profile);
  }
  return result;
}
export function factsMarkup(profile){
  if(!profile || !Object.keys(profile.fields).length)return '';
  const f=profile.fields;
  const labels={weightGrams:'Weight (BTO reference)',typicalLifespanYears:'Typical lifespan',ringedLongevity:'Longest ringed record (BTO)',historicalNames:'Historical nicknames',identification:'Identification',diet:'Diet',habitat:'Habitat',memorableFact:'Did you know?',bodyLength:'Body length',wingspan:'Wingspan',breeding:'Nesting',clutchSize:'Typical clutch',call:'Song and call',conservation:'UK conservation status'};
  const format=(key,field)=>key==='weightGrams'?`${field.value.toLocaleString('en-GB')} g`:key==='typicalLifespanYears'?`${field.value} years`:key==='conservation'?`${field.value} · ${field.assessment}`:Array.isArray(field.value)?field.value.join(', '):field.value;
  const row=key=>f[key]?`<div><dt>${labels[key]}</dt><dd>${e(format(key,f[key]))}</dd></div>`:'';
  const primary=['identification','diet','habitat','memorableFact'];
  const extra=['weightGrams','typicalLifespanYears','ringedLongevity','historicalNames','bodyLength','wingspan','breeding','clutchSize','call'];
  const guides=[profile.referenceGuide,profile.soundGuide].filter(Boolean);
  return `<section class="bird-facts" aria-label="About this bird"><h3>About this bird</h3>${f.conservation?`<p class="conservation-status status-${e(f.conservation.value.toLowerCase())}">UK conservation: <strong>${e(format('conservation',f.conservation))}</strong></p>`:''}<dl class="bird-facts-primary">${primary.map(row).join('')}</dl><details class="bird-more-details"><summary>More details</summary><dl>${extra.map(row).join('')}</dl><p class="bird-facts-note">Lifespan refers to birds reaching breeding age. Ringed records are BTO records, not typical lifespans or global maxima. Weight varies with sex and season. Historical nicknames are British regional names, not verified Hammersmith &amp; Fulham usage. UK conservation status is separate from borough reporting frequency.</p>${guides.map(g=>`<p><a href="${e(g.url)}" target="_blank" rel="noreferrer">${e(g.title)} (opens a new tab)</a></p>`).join('')}</details><details><summary>Fact sources</summary>${Object.entries(f).map(([key,source])=>`<p><strong>${labels[key]}</strong>: <a href="${e(source.sourceUrl)}" target="_blank" rel="noreferrer">${e(source.sourceTitle)}</a> · ${e(source.sourceSection)} · checked ${e(source.checkedOn)}${source.assessmentUrl?` · <a href="${e(source.assessmentUrl)}" target="_blank" rel="noreferrer">Assessment publication</a>`:''}</p>`).join('')}</details></section>`;
}
