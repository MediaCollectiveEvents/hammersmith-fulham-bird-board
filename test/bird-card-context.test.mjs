import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSpeciesLookup} from '../dist/bird-cards-data.mjs';
import {validateRankings} from '../dist/bird-rankings-data.mjs';
import {latestPublicReports,reconcileCardRankings,contextMarkup} from '../dist/bird-card-context.mjs';
import {validateFacts,factsMarkup} from '../dist/bird-facts.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../dist/data/${name}`,import.meta.url)));
const lookup=createSpeciesLookup(read('ebird-history.json'));
const robin=lookup.resolve('Robin');
const record={latin:robin.scientificName,date:'2026-10-10',hotspotId:'L1',reportType:'hotspot',observer:'PRIVATE PERSON',checklistId:'PRIVATE ID',lat:51.5};
const feed=records=>({source:'eBird',updatedAt:'2026-10-28T11:00:00Z',hotspots:[{locId:'L1',name:'Public Park'},{locId:'L2',name:'Other Park'}],records});
test('latest public report extracts whitelisted data, exact identity and all tied locations',()=>{
 const reports=latestPublicReports([feed([{...record,date:'2026-10-09'},record,{...record,hotspotId:'L2'},record])],lookup);
 assert.deepEqual(reports.get(robin.scientificName),{date:'2026-10-10',locations:['Other Park','Public Park'],feedUpdatedAt:'2026-10-28T11:00:00Z'});
 assert(!JSON.stringify([...reports]).includes('PRIVATE'));assert(!contextMarkup(robin,null,reports.get(robin.scientificName)).includes('PRIVATE'));
});
test('private/unknown localities, wrong identities, future and invalid dates withheld',()=>{
 for(const changes of [{reportType:'nearby'},{hotspotId:'UNKNOWN'},{latin:'unknown'},{date:'2026-02-31'},{date:'2026-12-01'}])assert.equal(latestPublicReports([feed([{...record,...changes}])],lookup).size,0);
 assert.equal(latestPublicReports([{...feed([record]),source:'not-connected'}],lookup).size,0);
});
test('Wetland public hotspot combines with borough feed without inventing additional locations',()=>{
 const wetland={source:'eBird',updatedAt:'2026-10-28T11:00:00Z',hotspotId:'L3',hotspotName:'Wetland',records:[{...record,hotspotId:'L3',reportType:undefined,date:'2026-10-12'}]};
 assert.deepEqual(latestPublicReports([feed([record]),wetland],lookup).get(robin.scientificName).locations,['Wetland']);
});
test('rankings match full historical universe; mismatch rejected; archive window remains explicit',()=>{
 const d=validateRankings(read('bird-rankings.json'));const ranks=reconcileCardRankings(d,lookup);assert.equal(ranks.size,133);
 const r=ranks.get(robin.scientificName);assert.equal(r.end,'2026-09-28');assert.match(contextMarkup(robin,r,null),/Archive window/);
 d.rankings.borough[0].records++;assert.throws(()=>reconcileCardRankings(d,lookup));
});
test('missing feeds/rankings show honest states and escaped location text',()=>{
 assert.match(contextMarkup(robin,null,null),/Recent reporting rank unavailable/);assert.match(contextMarkup(robin,null,null),/does not establish absence/);
 assert(!contextMarkup(robin,null,{date:'2026-10-10',locations:['<script>'],feedUpdatedAt:'2026-10-28'}).includes('<script>'));
});
test('factfile keeps core information visible and measurements behind More details, with dated conservation',()=>{
 const profiles=validateFacts(read('bird-facts.json'),lookup);const html=factsMarkup(profiles.get(robin.scientificName));
 assert.match(html,/Identification/);assert.match(html,/Diet/);assert.match(html,/Habitat/);assert.match(html,/More details/);assert.match(html,/BoCC5 \(2021\)/);assert.match(html,/RSPB species guide/);
 const mallard=profiles.get('Anas platyrhynchos');assert.equal(mallard.fields.conservation.value,'Amber');assert.equal(mallard.fields.conservation.assessment,'BoCC5 (2021)');
});
test('undated/unknown conservation status and unsafe references are rejected',()=>{
 for(const mutate of [p=>delete p.fields.conservation.assessment,p=>p.fields.conservation.value='Rare',p=>p.referenceGuide.url='javascript:alert(1)']){const d=read('bird-facts.json');mutate(d.profiles[0]);assert.throws(()=>validateFacts(d,lookup));}
});
