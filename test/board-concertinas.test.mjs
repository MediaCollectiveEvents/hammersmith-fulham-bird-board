import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('  let hotspotMap=null;'),html.indexOf('  function renderBento('));

function environment() {
  const focused=[],scrolled=[],markers=[],mapCalls=[],boards=new Map();
  const panel={open:false};
  const makeBoard=id=>({id,open:false,matches:selector=>selector==='details.hotspot-list',querySelector:()=>({focus:()=>focused.push(id)}),scrollIntoView:()=>scrolled.push(id),addEventListener(name,handler){this[name]=handler;}});
  boards.set('hotspot-L1',makeBoard('hotspot-L1'));boards.set('hotspot-L2',makeBoard('hotspot-L2'));
  const root={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[...boards.values()]};
  const mapRoot={innerHTML:''};
  const map={setView(...args){mapCalls.push(['view',...args]);return this;},fitBounds(...args){mapCalls.push(['bounds',...args]);},invalidateSize(){mapCalls.push(['resize']);},stop(){mapCalls.push(['stop']);},remove(){mapCalls.push(['remove']);}};
  const L={map(node,options){mapCalls.push(['create',options]);return map;},tileLayer(){return {addTo(){}};},circleMarker(point,options){
    const attributes={},events={};
    const element={setAttribute:(key,value)=>attributes[key]=value,addEventListener:(key,handler)=>events[key]=handler};
    const marker={attributes,events,handlers:{},style:options,setStyle(value){Object.assign(this.style,value);},bindTooltip(value){this.tooltip=value;},bindPopup(value){this.popup=value;},on(name,handler){this.handlers[name]=handler;},addTo(){},getElement:()=>element};
    markers.push(marker);return marker;
  }};
  const context=vm.createContext({L,console,Map,Number,String,Set,months:['January'],normalizeCommonName:name=>name,
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    speciesListMarkup:()=>'<ul><li>Public taxon</li></ul>',addSpeciesReport(entry,row){entry.reports++;entry.species.set(row.latin,{name:row.species});},
    localReports:{hotspots:[{locId:'L1',name:'Public Park',lat:51.49,lng:-.23},{locId:'L1',name:'Public Park',lat:51.49,lng:-.23},{locId:'L2',name:'Public Gardens',lat:51.50,lng:-.22}],records:[]},
    document:{getElementById:id=>boards.get(id),querySelector:selector=>selector==='#panel-hotspots'?panel:selector==='#hotspot-totals'?root:selector==='#hotspot-map'?mapRoot:null,querySelectorAll:()=>[...boards.values()]}
  });
  vm.runInContext(source,context);
  return {context,focused,scrolled,markers,mapCalls,boards,panel,root,mapRoot};
}
test('hotspot selection opens exactly its matching list and focuses its summary',()=>{
  const e=environment();e.boards.get('hotspot-L2').open=true;
  vm.runInContext("openHotspotBoard('hotspot-L1')",e.context);
  assert.equal(e.panel.open,true);assert.equal(e.boards.get('hotspot-L1').open,true);assert.equal(e.boards.get('hotspot-L2').open,false);
  assert.deepEqual(e.focused,['hotspot-L1']);assert.deepEqual(e.scrolled,['hotspot-L1']);
  vm.runInContext("openHotspotBoard('missing')",e.context);assert.equal(e.focused.length,1);
});
test('map markers deduplicate public location IDs and support click, Enter and Space',()=>{
  const e=environment();vm.runInContext('renderHotspotMap(new Map())',e.context);
  assert.equal(e.markers.length,2);
  const marker=e.markers[0];assert.equal(marker.attributes.role,'button');assert.equal(marker.attributes.tabindex,'0');
  assert.equal(marker.attributes['aria-controls'],'hotspot-L1');assert.match(marker.attributes['aria-label'],/Public Park/);
  marker.handlers.click();assert.equal(e.boards.get('hotspot-L1').open,true);assert.equal(marker.attributes['aria-expanded'],'true');
  e.markers[1].events.keydown({key:'Enter',preventDefault(){}});assert.equal(e.boards.get('hotspot-L2').open,true);assert.equal(e.boards.get('hotspot-L1').open,false);
  marker.events.keydown({key:' ',preventDefault(){}});assert.equal(e.boards.get('hotspot-L1').open,true);
  marker.events.keydown({key:'Escape',preventDefault(){throw Error('Unexpected key handling');}});
});
test('popup link opens the same list without relying on a browser hash jump',()=>{
  const e=environment();vm.runInContext('renderHotspotMap(new Map())',e.context);
  let callback,prevented=false;
  e.markers[0].handlers.popupopen({popup:{getElement:()=>({querySelector:()=>({addEventListener:(name,handler)=>callback=handler})})}});
  callback({preventDefault(){prevented=true;}});
  assert.ok(prevented);assert.equal(e.boards.get('hotspot-L1').open,true);
});
test('map disables stale zoom animations and refits on visible-panel resize',()=>{
  const e=environment();vm.runInContext('renderHotspotMap(new Map());fitHotspotMap()',e.context);
  const options=e.mapCalls.find(c=>c[0]==='create')[1];assert.equal(options.zoomAnimation,false);assert.equal(options.markerZoomAnimation,false);
  assert.ok(e.mapCalls.filter(c=>c[0]==='resize').length>=2);
  assert.ok(e.mapCalls.filter(c=>c[0]==='bounds').every(c=>c[2].animate===false));
});
test('hotspot/contributor groups close only sibling lists, retaining native keyboard semantics',()=>{
  const e=environment();vm.runInContext('setupEntityAccordions(document.querySelector("#hotspot-totals"))',e.context);
  e.boards.get('hotspot-L1').open=true;e.boards.get('hotspot-L2').open=true;e.boards.get('hotspot-L2').toggle();
  assert.equal(e.boards.get('hotspot-L1').open,false);
  assert.match(html,/<details class="entity-board hotspot-list" name="hotspot-lists"/);
  assert.match(html,/<details class="entity-board contributor-list" name="contributor-lists"/);
  assert.match(html,/setTimeout\(fitHotspotMap,0\)/);
});
test('report aliases with the same hotspot ID use one list and preserve counts',()=>{
  const e=environment();
  vm.runInContext("localReports.records=[{year:2026,month:1,reportType:'hotspot',hotspot:'Old public name',hotspotId:'L1',species:'Bird',latin:'Avis test'},{year:2026,month:1,reportType:'hotspot',hotspot:'Public Park',hotspotId:'L1',species:'Bird',latin:'Avis test'}];renderHotspotTotals(2026,1)",e.context);
  assert.equal((e.root.innerHTML.match(/id="hotspot-L1"/g)||[]).length,1);
  assert.match(e.root.innerHTML,/1 species · 2 species reports/);
  assert.match(e.root.innerHTML,/Public Park/);assert.doesNotMatch(e.root.innerHTML,/Old public name/);
  vm.runInContext('renderHotspotTotals(2026,1)',e.context);
  assert.ok(e.mapCalls.findIndex(c=>c[0]==='stop')<e.mapCalls.findIndex(c=>c[0]==='remove'));
});
test('lists remain usable when map library is unavailable',()=>{
  const e=environment();vm.runInContext('L=undefined;renderHotspotTotals(2026,1)',e.context);
  assert.match(e.root.innerHTML,/details class="entity-board hotspot-list"/);
  assert.match(e.mapRoot.innerHTML,/Open a hotspot list below/);
});
test('ranking views use exclusive native concertinas instead of a dropdown',async()=>{
  const ui=await fs.readFile(new URL('../dist/bird-rankings.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="rankings-view"/);
  assert.match(ui,/class="rankings-view" name="bird-ranking-views"/);
  assert.match(ui,/section\.addEventListener\('toggle'/);
  assert.match(ui,/other\.open = false/);
  assert.match(ui,/append\(control\('workspace'\)\)/);
  for(const title of ['Borough Rankings','Recent Rankings','Rising Species','Least Recorded','Seasonal Rankings'])assert.ok(ui.includes(title));
  for(const [,script]of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
});
