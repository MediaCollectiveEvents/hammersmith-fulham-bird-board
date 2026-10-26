import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('  function renderMovementOverview(){'),html.indexOf('  function render(){renderMovementOverview();'));
test('navigation names and combined movement board retain both seasonal tables',()=>{
  assert.match(html,/data-category="actual"[^>]*>This Month<\/button>/);
  assert.match(html,/data-category="expected"[^>]*>Movements<\/button>/);
  assert.equal((html.match(/data-open-panel="panel-movements"/g)||[]).length,1);
  assert.doesNotMatch(html,/id="panel-arrivals"|id="panel-departures"/);
  const board=html.slice(html.indexOf('id="panel-movements"'),html.indexOf('id="panel-recorded"'));
  for(const id of ['arrivals-board','departures-board','arrivals-rows','departures-rows','tv-boards'])assert.ok(board.includes(`id="${id}"`));
  assert.match(board,/not live movements or a forecast/);
  assert.match(html,/render\(\)\{renderMovementOverview\(\)/);
});
test('movement overview uses validated calendar classifications and suppresses unavailable totals',()=>{
  const target={innerHTML:''};
  const types=['Resident','Summer Visitor','Winter Visitor','Partial Migrant','Passage Migrant','Scarce / Irregular'];
  const context=vm.createContext({document:{querySelector:()=>target},migrationCalendar:types.flatMap((movement_type,i)=>Array.from({length:i+1},()=>({movement_type}))),esc:String,migrationCalendarUnavailableMessage:'Seasonal guidance is temporarily unavailable while borough migration data is being rebuilt.'});
  vm.runInContext(source+';renderMovementOverview()',context);
  assert.deepEqual([...target.innerHTML.matchAll(/<dd>(\d+)<\/dd>/g)].map(m=>Number(m[1])),[1,2,3,4,5,6]);
  assert.match(target.innerHTML,/not birds present or moving this month/);
  vm.runInContext('migrationCalendar=null;renderMovementOverview()',context);
  assert.match(target.innerHTML,/temporarily unavailable/);
  assert.doesNotMatch(target.innerHTML,/<dd>/);
});
