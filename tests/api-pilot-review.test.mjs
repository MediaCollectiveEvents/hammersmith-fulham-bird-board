import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCandidates} from '../pilot/review-candidates.mjs';
const row={species:'Synthetic bird',date:'2026-10-10',hotspotId:'LTEST',checklistId:'STEST',howMany:1};

test('identical duplicate inputs are one repeat with a received-row count',()=>{
 const result=reviewCandidates([row],[{...row},{...row}]);
 assert.equal(result.length,1);assert.equal(result[0].kind,'repeat');assert.equal(result[0].receivedRows,2);
});
test('same-key changes require review rather than altering previous data',()=>{
 const before=JSON.stringify(row);assert.equal(reviewCandidates([row],[{...row,howMany:7}])[0].kind,'same_key_update_review');assert.equal(JSON.stringify(row),before);
});
test('date, species and location changes sharing a checklist are held for identity review',()=>{
 for (const edit of [{date:'2026-10-11'},{species:'Another synthetic bird'},{hotspotId:'LOTHER'}]) {
  const result=reviewCandidates([row],[{...row,...edit}]);
  assert.deepEqual(result.map(x=>x.kind),['identity_review','missing_unverified']);
  assert.equal(result[0].possiblePriorKeys.length,1);
 }
});
test('missing input produces a freshness question, never a deletion',()=>{
 assert.deepEqual(reviewCandidates([row],[]).map(x=>x.kind),['missing_unverified']);
});
test('conflicting same-key responses are ambiguous independent of response order',()=>{
 const a={...row,howMany:2},b={...row,howMany:3};
 assert.deepEqual(reviewCandidates([row],[a,b]),reviewCandidates([row],[b,a]));
 assert.equal(reviewCandidates([row],[a,b])[0].kind,'ambiguous_review');
});
test('invalid dates and missing identity fields are held; invalid prior data stops review',()=>{
 for(const r of [{...row,date:'2026-02-30'},{...row,species:''},{...row,hotspotId:''}])assert.equal(reviewCandidates([row],[r])[0].kind,'invalid_review');
 assert.throws(()=>reviewCandidates([row,row],[]),/Duplicate prior key/);
});
test('new records or records lacking checklist identity still require review',()=>{
 for(const edit of [{checklistId:'SNEW'},{checklistId:null,date:'2026-10-11'}])assert.equal(reviewCandidates([row],[{...row,...edit}])[0].kind,'new_record_review');
});
test('frozen inputs work without mutations or accepted-output construction',()=>{
 const previous=Object.freeze([Object.freeze({...row})]);const incoming=Object.freeze([Object.freeze({...row,date:'2026-10-11'})]);
 const result=reviewCandidates(previous,incoming);assert.equal(result[0].kind,'identity_review');assert.equal(previous[0].date,'2026-10-10');
 assert.ok(result.every(x=>!['delete','accepted','publish'].includes(x.kind)));
});
