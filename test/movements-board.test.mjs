import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
test('navigation names and combined movement board retain both seasonal tables',()=>{
  assert.match(html,/data-category="actual"[^>]*>Actual Sightings<\/button>/);
  assert.match(html,/data-category="expected"[^>]*>Movements<\/button>/);
  assert.equal((html.match(/data-open-panel="panel-movements"/g)||[]).length,1);
  assert.doesNotMatch(html,/id="panel-arrivals"|id="panel-departures"/);
  const board=html.slice(html.indexOf('id="panel-movements"'),html.indexOf('id="panel-recorded"'));
  for(const id of ['arrivals-board','departures-board','arrivals-rows','departures-rows','tv-boards'])assert.ok(board.includes(`id="${id}"`));
  assert.match(board,/not live movements or a forecast/);
});
test('general migration explanation does not present unreviewed classification totals',()=>{
  const overview=html.slice(html.indexOf('<div class="movement-overview">'),html.indexOf('<section class="boards" id="tv-boards"'));
  assert.match(overview,/others visit for summer or winter/);
  assert.doesNotMatch(overview,/<dd>|movement-composition|Patterns across the validated archive/);
  assert.doesNotMatch(html,/renderMovementOverview|Classification totals cover/);
});
