import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSpeciesLookup} from '../dist/bird-cards-data.mjs';
import {validateFacts,factsMarkup} from '../dist/bird-facts.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../dist/data/${name}`,import.meta.url)));
const data=read('bird-facts.json'),lookup=createSpeciesLookup(read('ebird-history.json'));
test('five pilot identities reconcile, four sourced profiles and no parental hybrid measurements',()=>{
 const profiles=validateFacts(data,lookup);assert.equal(profiles.size,5);
 assert.equal([...profiles.values()].filter(p=>Object.keys(p.fields).length).length,4);
 assert.deepEqual(profiles.get('Larus argentatus x fuscus').fields,{});
 assert.equal(factsMarkup(profiles.get('Larus argentatus x fuscus')),'');
});
test('maximum ages remain distinct from typical life expectancy, weights use explicit BTO basis',()=>{
 const robin=validateFacts(data,lookup).get('Erithacus rubecula');
 assert.equal(robin.fields.weightGrams.value,19);assert.equal(robin.fields.typicalLifespanYears.value,2);
 assert.equal(robin.fields.ringedLongevity.value,'8 years, 4 months, 30 days');
 const html=factsMarkup(robin);assert.match(html,/Typical lifespan/);assert.match(html,/Longest ringed record/);assert.match(html,/reaching breeding age/);assert.match(html,/not verified Hammersmith/);assert.match(html,/Fact sources/);assert.match(html,/Ruddock/);
 assert.equal(validateFacts(data,lookup).get('Falco peregrinus').fields.weightGrams.value,889.3);
});
for(const [name,mutate] of Object.entries({pending:p=>p.fields.weightGrams.status='pending',source:p=>p.fields.weightGrams.sourceUrl='javascript:alert(1)',missingSource:p=>delete p.fields.weightGrams.sourceSection,unknownField:p=>p.fields.migrationStatus=p.fields.weightGrams,negative:p=>p.fields.weightGrams.value=-1,zero:p=>p.fields.typicalLifespanYears.value=0,hybrid:p=>{p.scientificName='Larus argentatus x fuscus';p.commonName=lookup.resolve(p.scientificName).commonName;}}))test(`reject ${name} facts`,()=>{
 const copy=structuredClone(data);mutate(copy.profiles[0]);assert.throws(()=>validateFacts(copy,lookup));
});
test('duplicate and incorrect taxon joins rejected; missing profiles stay hidden; text escaped',()=>{
 const copy=structuredClone(data);copy.profiles.push(copy.profiles[0]);assert.throws(()=>validateFacts(copy,lookup));
 const incorrect=structuredClone(data);incorrect.profiles[0].commonName='Mallard';assert.throws(()=>validateFacts(incorrect,lookup));
 assert.equal(factsMarkup(undefined),'');
 const p=structuredClone(data.profiles[0]);p.fields.historicalNames.value=['<script>'];assert(!factsMarkup(p).includes('<script>'));
});
