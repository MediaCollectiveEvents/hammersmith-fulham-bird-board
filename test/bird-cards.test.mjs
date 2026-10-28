import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSpeciesLookup,validateImages,cardMarkup,ambiguousTaxon,escapeHTML} from '../dist/bird-cards-data.mjs';
const history=JSON.parse(fs.readFileSync(new URL('../dist/data/ebird-history.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../dist/data/bird-images.json',import.meta.url)));
const lookup=createSpeciesLookup(history);
test('current public universe, counts and exact scientific identities reconcile with rankings',()=>{
 const rankings=JSON.parse(fs.readFileSync(new URL('../dist/data/bird-rankings.json',import.meta.url)));
 assert.equal(lookup.rows.length,history.taxonCount);
 for(const row of rankings.rankings.borough){const item=lookup.resolve(row.scientificName);assert.equal(item.rank,row.rank);assert.equal(item.records,row.records);assert.equal(item.lastRecorded,row.lastRecorded);}
 assert.equal(lookup.resolve('Robin').scientificName,'Erithacus rubecula');
 assert.equal(lookup.resolve('Pied Wagtail').scientificName,'Motacilla alba');
 assert.equal(lookup.resolve('Robin','wrong identity'),null);
 assert.equal(lookup.resolve('unknown'),null);
});
test('ties use original alphabetical common names independently of incoming order',()=>{
 const d=createSpeciesLookup({taxonCount:3,species:[{commonName:'Z',scientificName:'Z z',records:2},{commonName:'B',scientificName:'B b',records:1},{commonName:'A',scientificName:'A a',records:1}]});
 assert.deepEqual(d.rows.map(r=>r.commonName),['Z','A','B']);
});
test('duplicate scientific identities and invalid counts rejected',()=>{
 const row=history.species[0];assert.throws(()=>createSpeciesLookup({taxonCount:2,species:[row,row]}));
 assert.throws(()=>createSpeciesLookup({taxonCount:1,species:[{...row,records:-1}]}));
});
test('ambiguous normalized aliases fail closed',()=>{
 const d=createSpeciesLookup({taxonCount:2,species:[{commonName:'European X',scientificName:'A a',records:1},{commonName:'X',scientificName:'B b',records:1}]});assert.equal(d.resolve('X'),null);
});
test('approved library contains 121 licensed photos, ten rejections and two withheld hybrids',()=>{
 const photos=validateImages(manifest,lookup);assert.equal(photos.size,121);assert.equal(manifest.images.length,133);
 assert.equal(manifest.images.filter(p=>p.verificationStatus==='manual-review').length,2);
 for(const p of photos.values())assert(cardMarkup(lookup.resolve(p.scientificName),p).includes(escapeHTML(p.creator)));
 assert(ambiguousTaxon('Larus argentatus x fuscus'));
});
for(const [name,change] of Object.entries({unlicensed:p=>delete p.licenceUrl,unverified:p=>p.verificationStatus='candidate',ambiguous:p=>p.scientificName='Larus argentatus x fuscus',unsafe:p=>p.imageUrl='javascript:alert(1)',duplicate:p=>{}}))test(`catalogue rejects ${name} photographs`,()=>{
 const data=structuredClone(manifest);change(data.images[0]);if(name==='duplicate')data.images[1].sourcePage=data.images[0].sourcePage;
 assert.throws(()=>validateImages(data,lookup));
});
test('missing data, missing photograph, attribution and escaped names render safely',()=>{
 const row=lookup.resolve('Robin');const markup=cardMarkup({...row,lastRecorded:null});assert.match(markup,/Unavailable/);assert.match(markup,/No verified photograph/);assert.match(markup,/observation records/);assert.match(cardMarkup(null),/unavailable/);
 assert(!cardMarkup({...row,commonName:'<script>'}).includes('<script>'));
 const photo=validateImages(manifest,lookup).get(row.scientificName);const m=cardMarkup(row,photo);assert(m.includes(photo.sourcePage));assert(m.includes(photo.licenceUrl));assert(m.includes('no crop'));
});
