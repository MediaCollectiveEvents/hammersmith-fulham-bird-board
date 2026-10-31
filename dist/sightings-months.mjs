// Month selection uses London civil time; eBird's retained YYYY-MM-DD values
// already represent the observation's local date and must not be shifted.
export function londonMonth(date = new Date(), offset = 0) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit'}).formatToParts(date);
  const year = Number(parts.find(p=>p.type==='year').value), month = Number(parts.find(p=>p.type==='month').value);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth()+1).padStart(2,'0')}`;
}
export function validObservationDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date+'T00:00:00Z')) && new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
// Exact existing updater identity: no new reconciliation or ingestion semantics.
export const observationKey = r => `${r.species}|${r.date}|${r.hotspotId || r.hotspot}|${r.checklistId || ''}`;
export function monthlyTotals(records) {
  return {reports:records.length,species:new Set(records.map(r=>r.species)).size,
    hotspots:new Set(records.filter(r=>(r.reportType||'hotspot')==='hotspot').map(r=>r.hotspotId||r.hotspot)).size,
    lastRecorded:records.map(r=>r.date).sort().at(-1)||null};
}
