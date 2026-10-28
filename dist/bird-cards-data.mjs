// Public aggregates only. Scientific identity is exact; ambiguous aliases fail closed.
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const displayName = (name, latin='') => latin === 'Motacilla alba' ? 'Pied Wagtail' : String(name).replace(/^(?:Eurasian|European)\s+/i,'').replace(/^Gray(?=\s)/i,'Grey');
export const ambiguousTaxon = name => /\s[x×]\s|hybrid|\//i.test(name);
export function createSpeciesLookup(history) {
  if (!Array.isArray(history.species) || history.species.length !== history.taxonCount) throw Error('Invalid taxon universe');
  const scientific = new Map(), aliases = new Map();
  const rows = [...history.species].sort((a,b) => b.records-a.records || (a.commonName < b.commonName ? -1 : a.commonName > b.commonName ? 1 : 0));
  for (const [i,row] of rows.entries()) {
    if (!row.commonName || !row.scientificName || scientific.has(row.scientificName) || !Number.isSafeInteger(row.records) || row.records < 0) throw Error('Invalid species identity/count');
    const item = {commonName:row.commonName, scientificName:row.scientificName, records:row.records, lastRecorded:row.lastRecorded, rank:i+1};
    scientific.set(row.scientificName,item);
    for (const name of new Set([row.commonName,displayName(row.commonName,row.scientificName)])) {
      aliases.set(name, aliases.has(name) ? null : item);
    }
  }
  return {rows:[...scientific.values()], resolve:(name,latin) => latin ? scientific.get(latin) ?? null : scientific.get(name) ?? aliases.get(name) ?? null};
}
export function validateImages(manifest, lookup) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.images)) throw Error('Invalid image manifest');
  const taxa = new Set(), sources = new Set();
  for (const p of manifest.images) {
    if (taxa.has(p.scientificName) || !lookup.resolve(p.scientificName) || p.commonName !== lookup.resolve(p.scientificName).commonName) throw Error('Duplicate/unknown image taxon');
    taxa.add(p.scientificName);
    if (p.verificationStatus !== 'verified') { if (p.imageUrl) throw Error('Unverified image exposed'); continue; }
    if (ambiguousTaxon(p.scientificName)) throw Error('Ambiguous taxonomy requires manual review');
    for (const key of ['commonName','sourceTitle','sourcePage','creator','licence','licenceUrl','attribution','verificationEvidence']) if (!p[key]) throw Error('Incomplete image rights/identity');
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.sourcePage) || !/^https:\/\/creativecommons.org\/(licenses\/(by|by-sa)\/(2\.0|2\.5|3\.0|4\.0)|publicdomain\/(zero|mark)\/1\.0)\/?$/.test(p.licenceUrl) || !/^\.\/images\/birds\/[a-z-]+\.webp$/.test(p.imageUrl) || typeof p.modifications !== 'string' || !Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1 || !/^\.\/images\/birds\/[a-z-]+-400\.webp$/.test(p.smallImageUrl)) throw Error('Unsupported image metadata');
    if (sources.has(p.sourcePage)) throw Error('Duplicate photograph assignment');
    sources.add(p.sourcePage);
  }
  return new Map(manifest.images.filter(p=>p.verificationStatus==='verified').map(p=>[p.scientificName,p]));
}
export function cardMarkup(item, photo) {
  const e=escapeHTML;
  if (!item) return '<h2 id="bird-card-title">Species information unavailable</h2><p>No unambiguous match exists in the validated public archive.</p>';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(item.lastRecorded || '') && Number.isFinite(Date.parse(item.lastRecorded)) && new Date(item.lastRecorded).toISOString().slice(0,10) === item.lastRecorded ? item.lastRecorded : 'Unavailable';
  return `<div class="bird-card-photo">${photo ? `<img src="${e(photo.imageUrl)}" width="${photo.width}" height="${photo.height}" srcset="${e(photo.smallImageUrl)} 400w, ${e(photo.imageUrl)} 800w" sizes="(max-width:620px) calc(100vw - 32px), 560px" alt="${e(displayName(item.commonName,item.scientificName))}" decoding="async"><p class="bird-image-failure" hidden>Photograph temporarily unavailable.</p>` : '<img src="./icons/bird.svg" width="96" height="96" alt=""><p>No verified photograph available.</p>'}</div><h2 id="bird-card-title">${e(displayName(item.commonName,item.scientificName))}</h2><p><i>${e(item.scientificName)}</i></p><dl class="bird-card-stats"><div><dt>Borough Rank</dt><dd>${item.rank}</dd></div><div><dt>Historical observation records</dt><dd>${item.records.toLocaleString('en-GB')}</dd></div><div><dt>Last recorded in archive</dt><dd>${e(date)}</dd></div></dl><p>Observation records count reports, not individual birds. Equal counts use alphabetical original common names. Archive coverage and recording effort vary; missing records do not prove absence.</p>${ambiguousTaxon(item.scientificName) ? '<p>Hybrid taxon: photographic identification requires manual review.</p>' : ''}<p>Borough migration timing and historical hotspot locations are unavailable pending verification.</p><p><a href="https://www.rspb.org.uk/birds-and-wildlife/a-z?search=${encodeURIComponent(displayName(item.commonName,item.scientificName))}" target="_blank" rel="noreferrer">Search the RSPB bird guide (opens a new tab)</a></p>${photo ? `<p class="bird-card-credit">${e(photo.attribution)} · <a href="${e(photo.licenceUrl)}" target="_blank" rel="noreferrer">${e(photo.licence)}</a> · <a href="${e(photo.sourcePage)}" target="_blank" rel="noreferrer">Commons source</a>. ${e(photo.modifications)}</p>` : ''}`;
}
