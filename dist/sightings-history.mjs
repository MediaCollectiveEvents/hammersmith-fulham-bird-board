import {londonMonth,validObservationDate,monthlyTotals} from './sightings-months.mjs';
import {sanitizeBoroughFeed} from './borough-hotspots.mjs';
export function setupSightingsHistory({feed,onSelect,available=true,now=new Date()}) {
  const select=document.querySelector('#sightings-period'),status=document.querySelector('#sightings-coverage'),label=document.querySelector('#sightings-month-label');
  const months=[londonMonth(now),londonMonth(now,-1)];let request=0;
  async function choose(){
    const token=++request,month=months[select.value==='last'?1:0], [year,number]=month.split('-').map(Number);
    const title=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'Europe/London'}).format(new Date(`${month}-15T12:00:00Z`));
    label.textContent=title;status.textContent='Loading collected sightings…';
    // Clear the previous period immediately; stale data must never acquire a new label.
    onSelect({year,month:number,archived:select.value==='last',feed:{...feed,records:[]},loading:true});
    let selected,notice,fromArchive=false;
    if(select.value==='this'&&available){
      selected={...feed,records:feed.records.filter(r=>r.date?.slice(0,7)===month)};
      notice='Partial collected coverage, not a complete eBird census.';
    }else{
      try{
        const response=await fetch(`./data/sightings-archive/${month}.json`,{cache:'no-store'});
        if(!response.ok)throw Error('Archive unavailable');
        const archive=await response.json();
        if(archive.schemaVersion!==1||archive.source!=='eBird'||archive.month!==month||!Array.isArray(archive.records)||archive.records.some(r=>!validObservationDate(r.date)||r.date.slice(0,7)!==month||Number(r.year)!==year||Number(r.month)!==number))throw Error('Invalid archive');
        selected=sanitizeBoroughFeed(archive);fromArchive=true;notice=archive.coverage?.notice||'Partial collected coverage, not a complete eBird census.';
      }catch{
        // The retained validated snapshot is a last-known-good fallback, never a backfill.
        selected={...feed,records:feed.records.filter(r=>r.date?.slice(0,7)===month)};
        notice=selected.records.length?'Archive unavailable; showing partial records retained in the last-known-good feed.':'No collected archive is available for this month. This does not mean no birds were present.';
      }
    }
    if(token!==request)return;
    const totals=monthlyTotals(selected.records);
    if(!totals.reports&&!notice.startsWith('No collected archive'))notice+=' No collected reports are available for this month; this does not prove absence.';
    status.textContent=`${notice} ${totals.reports} collected reports${totals.lastRecorded?`; latest observation ${totals.lastRecorded}`:''}.`+(select.value==='last'||fromArchive?' Observer names are not included in monthly archives. BirdWeather remains a separate recent-detections feed.':' BirdWeather remains a separate recent-detections feed.');
    onSelect({year,month:number,archived:select.value==='last'||fromArchive,feed:selected,totals});
  }
  select.addEventListener('change',choose);choose();
}
