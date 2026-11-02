import {observationKey,validObservationDate} from './sightings-months.mjs';
export function rollingPeriod(id='30days',now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  const end=`${parts.year}-${parts.month}-${parts.day}`,civil=new Date(`${end}T12:00:00Z`);
  const days=id==='today'?0:id==='week'?(civil.getUTCDay()+6)%7:29;
  civil.setUTCDate(civil.getUTCDate()-days);
  const start=civil.toISOString().slice(0,10),months=[];
  const cursor=new Date(`${start.slice(0,7)}-01T12:00:00Z`);
  while(cursor.toISOString().slice(0,7)<=end.slice(0,7)){months.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
  return {id,label:id==='today'?'Today':id==='week'?'This Week':'Last 30 Days',start,end,months};
}
export function periodRecords(period,archives,live=[]) {
  const unique=new Map();
  for(const r of [...archives.flatMap(a=>a.records),...live])if(validObservationDate(r.date)&&r.date>=period.start&&r.date<=period.end)unique.set(observationKey(r),r);
  return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||observationKey(a).localeCompare(observationKey(b)));
}
export function feedStatus(feed,available,now=new Date()) {
  const stamp=Date.parse(feed.updatedAt),reliable=Number.isFinite(stamp)&&stamp<=now.getTime()+300000;
  if(!available||feed.source!=='eBird')return 'Live eBird feed unavailable; showing retained records where available.';
  if(!reliable)return 'Last successful feed update unavailable.';
  return `${now.getTime()-stamp>48*3600000?'Warning: feed is over 48 hours old. ':''}Last successful feed update: ${new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(new Date(stamp))} (Europe/London).`;
}
