import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {londonNoonDecision} from '../scripts/check-london-noon.mjs';
const candidates=['0 11 * * *','0 12 * * *'];
for(const [day,expected] of [
  ['2026-01-15',1],['2026-07-15',0],
  ['2026-03-28',1],['2026-03-29',0],['2026-03-30',0],
  ['2026-10-24',0],['2026-10-25',1],['2026-10-26',1],
  ['2026-12-31',1],['2027-01-01',1]
])test(`one local-noon candidate on ${day}`,()=>{
  const decisions=candidates.map(schedule=>londonNoonDecision({eventName:'schedule',schedule,now:new Date(day+'T14:30:00Z')}));
  assert.deepEqual(decisions.map(d=>d.run),[expected===0,expected===1]);
});
test('a delayed wrong-season trigger cannot become a second noon refresh',()=>{
  assert.equal(londonNoonDecision({eventName:'schedule',schedule:candidates[0],now:new Date('2026-11-02T12:30Z')}).run,false);
  assert.equal(londonNoonDecision({eventName:'schedule',schedule:candidates[1],now:new Date('2026-07-02T15:30Z')}).run,false);
});
test('every day of a complete year has exactly one eligible candidate',()=>{
  for(let day=new Date('2026-01-01T14:00Z');day.getUTCFullYear()===2026;day.setUTCDate(day.getUTCDate()+1))assert.equal(candidates.filter(schedule=>londonNoonDecision({eventName:'schedule',schedule,now:day}).run).length,1);
});
test('manual dispatch and push bypass the clock, even with an invalid date/schedule',()=>{
  for(const eventName of ['workflow_dispatch','push'])assert.equal(londonNoonDecision({eventName,schedule:'unexpected',now:new Date(NaN)}).run,true);
});
test('unknown scheduled triggers fail closed',()=>assert.throws(()=>londonNoonDecision({eventName:'schedule',schedule:'23 5 * * *'}),/Unrecognized/));
test('workflow bypasses a skipped time job for manual/push runs and retains collector tail',async()=>{
  const workflow=await fs.readFile(new URL('../.github/workflows/update-ebird.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/cron: '0 11 \* \* \*'/);assert.match(workflow,/cron: '0 12 \* \* \*'/);
  assert.match(workflow,/github.event_name == 'schedule'/);assert.match(workflow,/always\(\) && !cancelled\(\)/);assert.match(workflow,/github.event_name != 'schedule' \|\| needs.london-noon.outputs.run == 'true'/);
  assert.doesNotMatch(workflow,/deploy-pages|pages: write/);
});
