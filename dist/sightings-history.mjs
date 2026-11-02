import {validObservationDate,monthlyTotals} from './sightings-months.mjs';
import {rollingPeriod,periodRecords,feedStatus} from './sightings-periods.mjs';
import {sanitizeBoroughFeed} from './borough-hotspots.mjs';
export function setupSightingsHistory({feed,onSelect,available=true,now}) {
  const buttons=[...document.querySelectorAll('[data-period]')],status=document.querySelector('#sightings-coverage'),label=document.querySelector('#sightings-month-label');
  let request=0;
  async function choose(id){
    const clock=now||new Date(),token=++request,period=rollingPeriod(id,clock);
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===id)));
    label.textContent=`${period.start} – ${period.end} · Europe/London`;
    status.textContent='Loading collected sightings…';
    onSelect({period,feed:{...feed,records:[]},loading:true});
    const missing=[],archives=await Promise.all(period.months.map(async month=>{
      try{
        const response=await fetch(`./data/sightings-archive/${month}.json`,{cache:'no-store'});
        if(!response.ok)throw Error('Archive unavailable');
        const archive=await response.json();
        if(archive.schemaVersion!==1||archive.source!=='eBird'||archive.month!==month||!Array.isArray(archive.records)||archive.records.some(r=>!validObservationDate(r.date)||r.date.slice(0,7)!==month||Number(r.year)!==Number(month.slice(0,4))||Number(r.month)!==Number(month.slice(5))))throw Error('Invalid archive');
        return sanitizeBoroughFeed(archive);
      }catch{missing.push(month);return {records:[]};}
    }));
    if(token!==request)return;
    const records=periodRecords(period,archives,sanitizeBoroughFeed(feed).records),totals=monthlyTotals(records);
    const unavailable=!available&&!records.length&&missing.length===period.months.length;
    status.textContent=`${feedStatus(feed,available,clock)} ${globalThis.navigator?.onLine===false?'Offline: cached records may be out of date. ':''}Partial collected coverage, not a complete eBird census. ${missing.length?`Archives unavailable for ${missing.sort().join(', ')}; retained feed records are used where available. `:''}${totals.reports} collected reports · ${totals.species} species${totals.lastRecorded?` · latest observation ${totals.lastRecorded}`:''}. BirdWeather remains a separate recent-detections feed; WWT is outside the borough.`;
    onSelect({period,feed:{...feed,records},totals,unavailable});
  }
  buttons.forEach(button=>button.addEventListener('click',()=>choose(button.dataset.period)));
  choose('30days');
}
