import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sanitizeBoroughFeed,isExcludedBoroughLocation} from '../dist/borough-hotspots.mjs';
import {validObservationDate,observationKey,monthlyTotals} from '../dist/sightings-months.mjs';

const notice='Partial collected coverage, not a complete eBird census. Missing reports do not prove absence. The recent API is limited to a rolling 30-day window and may omit records.';
const fields=['species','latin','speciesCode','year','month','date','notable','reportType','hotspot','hotspotId','checklistId','howMany'];
function publicRecord(r) {
  if(!r || !validObservationDate(r.date) || typeof r.species!=='string' || !r.species || !r.hotspot ||
     Number(r.year)!==Number(r.date.slice(0,4)) || Number(r.month)!==Number(r.date.slice(5,7))) throw Error('Invalid validated observation; archive unchanged.');
  return Object.fromEntries(fields.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]));
}
export function buildMonthlyArchives(feed, previous = new Map()) {
  if(feed?.source!=='eBird' || !Array.isArray(feed.records) || !Number.isFinite(Date.parse(feed.updatedAt))) throw Error('Invalid source feed; archive unchanged.');
  const grouped=new Map();
  for(const [month,archive] of previous) {
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || archive?.schemaVersion!==1 || archive.month!==month || archive.source!=='eBird' || !Array.isArray(archive.records)) throw Error('Invalid previous archive; archive unchanged.');
    grouped.set(month,new Map());
    for(const raw of archive.records) {
      const r=publicRecord(raw);
      if(r.date.slice(0,7)!==month)throw Error('Wrong archive month; archive unchanged.');
      if(!isExcludedBoroughLocation(r))grouped.get(month).set(observationKey(r),r);
    }
  }
  const clean=sanitizeBoroughFeed(feed);
  for(const raw of clean.records) {
    const r=publicRecord(raw),month=r.date.slice(0,7);
    if(!grouped.has(month))grouped.set(month,new Map());
    grouped.get(month).set(observationKey(r),r);
  }
  const output=new Map();
  for(const month of [...grouped.keys()].sort()) {
    const records=[...grouped.get(month).values()].sort((a,b)=>a.date.localeCompare(b.date)||observationKey(a).localeCompare(observationKey(b)));
    const old=previous.get(month);
    const directory=new Map((old?.hotspots||[]).filter(h=>!isExcludedBoroughLocation(h)).map(h=>[h.locId,h]));
    for(const h of clean.hotspots)directory.set(h.locId,h);
    const hotspots=[...directory.values()].map(h=>({locId:h.locId,name:h.name,lat:h.lat,lng:h.lng})).sort((a,b)=>a.locId.localeCompare(b.locId));
    const unchanged=old && JSON.stringify(old.records)===JSON.stringify(records) && JSON.stringify(old.hotspots)===JSON.stringify(hotspots);
    output.set(month,{schemaVersion:1,source:'eBird',month,timeZone:'Europe/London',
      coverage:{status:'partial',notice,firstObservationDate:records[0]?.date||null,lastObservationDate:records.at(-1)?.date||null,
        sourceFeedUpdatedAt:unchanged?old.coverage.sourceFeedUpdatedAt:feed.updatedAt},
      totals:monthlyTotals(records),hotspots,records});
  }
  return output;
}
export async function archiveSightings({feedPath=new URL('../dist/data/observations.json',import.meta.url),directory=new URL('../dist/data/sightings-archive/',import.meta.url)}={}) {
  const dir=directory instanceof URL?fileURLToPath(directory):directory;
  let names=[];try{names=await fs.readdir(dir);}catch(e){if(e.code!=='ENOENT')throw e;}
  const previous=new Map();
  for(const name of names.filter(n=>/^\d{4}-\d{2}\.json$/.test(n)).sort())previous.set(name.slice(0,7),JSON.parse(await fs.readFile(path.join(dir,name),'utf8')));
  const feed=JSON.parse(await fs.readFile(feedPath,'utf8'));
  // Validate and generate every month before touching any published file.
  const archives=buildMonthlyArchives(feed,previous);
  const files=new Map([...archives].map(([month,data])=>[`${month}.json`,data]));
  files.set('index.json',{schemaVersion:1,source:'eBird',timeZone:'Europe/London',coverageNotice:notice,
    months:[...archives].map(([month,a])=>({month,...a.totals,coverage:a.coverage}))});
  await fs.mkdir(dir,{recursive:true});let changed=0;
  for(const [name,data] of files){
    const target=path.join(dir,name),bytes=JSON.stringify(data,null,2)+'\n';
    let old;try{old=await fs.readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(old===bytes)continue;
    const temporary=target+'.tmp';await fs.writeFile(temporary,bytes);await fs.rename(temporary,target);changed++;
  }
  return {months:[...archives.keys()],changed};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(await archiveSightings());
}
