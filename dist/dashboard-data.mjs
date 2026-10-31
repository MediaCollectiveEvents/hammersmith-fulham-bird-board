import {createSpeciesLookup,ambiguousTaxon} from './bird-cards-data.mjs';
import {sanitizeBoroughFeed} from './borough-hotspots.mjs';
import {londonMonth,monthlyTotals} from './sightings-months.mjs';
const migrants=new Set(['Summer Visitor','Winter Visitor','Partial Migrant','Passage Migrant']);
export const heldTaxon = item => !item || item.scientificName==='Anas crecca' || item.commonName==='Green-winged Teal' || ambiguousTaxon(item.commonName) || ambiguousTaxon(item.scientificName);
export function buildDashboard({history,rankings,calendar=[],feed,seasonRecords=null,birdweather={records:[]},publicationReady=false,now=new Date()}) {
  const monthKey=londonMonth(now),month=Number(monthKey.slice(5)),lookup=createSpeciesLookup(history);
  const clean=sanitizeBoroughFeed(feed),reports=clean.records.filter(r=>r.date?.slice(0,7)===monthKey);
  const result={monthKey,month,updatedAt:feed.updatedAt,totals:monthlyTotals(reports),news:[],arrivals:[],departures:[],here:[],byScientific:new Map(),notice:''};
  if(!publicationReady){result.notice='Seasonal and editorial features are withheld until the matching validated release is available.';return result;}
  const eligible=calendar.flatMap(row=>{const item=lookup.resolve(row['COMMON NAME']);return heldTaxon(item)||!migrants.has(row.movement_type)?[]:[{...item,...row}];});
  const publicIds=new Set(clean.hotspots.map(h=>h.locId));
  for(const item of eligible){
    const recent=reports.filter(r=>r.latin===item.scientificName).sort((a,b)=>a.date.localeCompare(b.date));
    const acoustic=(birdweather.records||[]).filter(r=>r.latin===item.scientificName&&r.timestamp?.slice(0,7)===monthKey&&Number(r.confidence)>=Number(birdweather.confidenceThreshold||0.7)).sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))).at(-1);
    const pattern=Array.from({length:12},(_,i)=>{const row=rankings.rankings.seasonal[String(i+1)]?.find(r=>r.commonName===item.commonName);return row?{records:row.records,years:row.yearsWithRecords}:null;});
    const entry={...item,pattern,recent,lastReport:recent.at(-1)?.date||null,acoustic:acoustic?.timestamp||null,route:null};
    result.byScientific.set(item.scientificName,entry);
    if(Number(item.arrival_month)===month)result.arrivals.push(entry);
    if(Number(item.departure_month)===month)result.departures.push(entry);
    // Historical extrema are not a verified continuous presence window.
    if(recent.length || pattern[month-1]?.records>0)result.here.push(entry);
  }
  const order=(a,b)=>a.commonName.localeCompare(b.commonName);
  for(const key of ['arrivals','departures'])result[key].sort(order);
  result.here.sort((a,b)=>Number(!!b.lastReport)-Number(!!a.lastReport)||order(a,b));
  result.notice=`${result.arrivals.length} expected arrival${result.arrivals.length===1?'':'s'} and ${result.departures.length} expected departure${result.departures.length===1?'':'s'} in the published calendar. These are recurring first/last report months, not observed migration events. Here This Season uses actual reports or historical monthly evidence, not an inferred continuous stay.`;
  const species=new Map();
  for(const r of reports){const item=lookup.resolve(r.species,r.latin);if(heldTaxon(item))continue;const found=species.get(item.scientificName)||{...item,reports:[]};found.reports.push(r);species.set(item.scientificName,found);}
  const candidates=[...species.values()].map(item=>({...item,reports:item.reports.sort((a,b)=>a.date.localeCompare(b.date)||String(a.hotspot).localeCompare(String(b.hotspot))||String(a.checklistId).localeCompare(String(b.checklistId)))})).sort(order);
  const rarity=[...candidates].filter(i=>i.records>0).sort((a,b)=>a.records-b.records||order(a,b));
  const add=(category,item,headline,explanation,priority,report)=>{if(!item)return;const last=report||item.reports.at(-1);result.news.push({category,item,headline,explanation,priority,date:last.date,hotspot:last.hotspot,evidence:'Validated borough report'});};
  if(rarity[0])add('Rarest this month',rarity[0],`${rarity[0].commonName}: the month’s least-recorded archive species`,`${rarity[0].records} records in the available historical borough archive. Rarity here measures archive reporting frequency, not biological rarity.`,1);
  const notable=rarity.find(i=>i.reports.some(r=>r.notable===true)&&i!==rarity[0]);
  add('Most notable',notable,notable?`${notable.commonName}, flagged notable by eBird`:'','The validated borough feed marks this report notable. This is a report classification, not evidence of a new arrival.',2,notable?.reports.filter(r=>r.notable===true).at(-1));
  const arrival=candidates.find(i=>result.arrivals.some(a=>a.scientificName===i.scientificName)&&i!==rarity[0]&&i!==notable);
  add('Seasonal arrival',arrival,arrival?`${arrival.commonName}: expected and reported`:'','The calendar arrival month overlaps a human report. The report does not establish when migration occurred.',3);
  // Calendar seasons, explicitly bounded by retained coverage, never first-ever.
  const startMonth=month===12?12:month<=2?12:month<=5?3:month<=8?6:9;
  const seasonYear=month<=2?Number(monthKey.slice(0,4))-1:Number(monthKey.slice(0,4));
  const seasonStart=`${seasonYear}-${String(startMonth).padStart(2,'0')}-01`;
  const retained=Array.isArray(seasonRecords)?sanitizeBoroughFeed({...feed,records:seasonRecords}).records:null;
  const first=candidates.filter(i=>result.byScientific.has(i.scientificName)).find(i=>{
    if(!retained)return false;const available=retained.filter(r=>r.latin===i.scientificName&&r.date>=seasonStart&&r.date<=i.reports[0].date).sort((a,b)=>a.date.localeCompare(b.date));return available[0]?.date===i.reports[0].date;
  });
  add('First retained seasonal report',first,first?`${first.commonName}: first in the retained seasonal sample`:'',first?`Earliest retained report since ${seasonStart}: ${first.reports[0].date}. Coverage is partial; this is not a claim of the season’s first arrival.`:'',4,first?.reports[0]);
  const spots=new Map();for(const r of reports.filter(r=>publicIds.has(r.hotspotId))){const rows=spots.get(r.hotspotId)||[];rows.push(r);spots.set(r.hotspotId,rows);}
  const busiest=[...spots].sort((a,b)=>new Set(b[1].map(r=>r.latin||r.species)).size-new Set(a[1].map(r=>r.latin||r.species)).size||a[0].localeCompare(b[0]))[0];
  if(busiest){const item=rarity.find(i=>i.reports.some(r=>r.hotspotId===busiest[0]));add('Hotspot highlight',item,item?`${new Set(busiest[1].map(r=>r.latin||r.species)).size} species reported at ${busiest[1][0].hotspot}`:'','The busiest public borough hotspot by distinct species in this month’s collected sample. Recording effort varies.',5,item?.reports.filter(r=>r.hotspotId===busiest[0]).at(-1));}
  const riser=[...rankings.rankings.rising].filter(r=>r.rankChange>0).sort((a,b)=>b.rankChange-a.rankChange||a.commonName.localeCompare(b.commonName)).map(r=>({rank:r,item:candidates.find(i=>i.commonName===r.commonName)})).find(x=>x.item);
  if(riser)add('Biggest riser',riser.item,`${riser.item.commonName}: up ${riser.rank.rankChange} reporting ranks`,`${riser.rank.rankChange} places higher in the archive’s ${rankings.recentWindow.days}-day reporting window ending ${rankings.recentWindow.end}, compared with all-time rank. Reporting activity is not population growth.`,6);
  const used=new Set();result.news=result.news.sort((a,b)=>a.priority-b.priority||a.item.commonName.localeCompare(b.item.commonName)).filter(n=>{if(used.has(n.item.scientificName))return false;used.add(n.item.scientificName);return true;}).slice(0,4);
  return result;
}
