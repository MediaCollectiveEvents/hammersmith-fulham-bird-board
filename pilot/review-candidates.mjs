// Offline review prototype only: no network, writes, accepted union or production imports.
// Checklist overlap is a review signal, never proof of observation identity.
const stable = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
const key = r => JSON.stringify([r.species,r.date,r.hotspotId || r.hotspot,r.checklistId || '']);
const valid = r => r && typeof r==='object' && typeof r.species==='string' && r.species.trim() &&
  typeof r.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
  Number.isFinite(Date.parse(r.date)) && new Date(r.date).toISOString().slice(0,10)===r.date &&
  typeof (r.hotspotId || r.hotspot)==='string' && (r.hotspotId || r.hotspot).trim();

export function reviewCandidates(previous, incoming) {
  if (!Array.isArray(previous) || !Array.isArray(incoming)) throw new TypeError('Expected record arrays');
  if (previous.some(r=>!valid(r))) throw new Error('Invalid prior record: review stopped');
  const prior = new Map();
  for (const r of previous) {
    if (prior.has(key(r))) throw new Error('Duplicate prior key: review stopped');
    prior.set(key(r),r);
  }
  const groups = new Map(), decisions=[];
  incoming.forEach((r,index)=>{
    if (!valid(r)) { decisions.push({kind:'invalid_review',index}); return; }
    const k=key(r);groups.set(k,[...(groups.get(k)||[]),r]);
  });
  for (const [k, rows] of groups) {
    if (new Set(rows.map(stable)).size>1) { decisions.push({kind:'ambiguous_review',key:k});continue; }
    const r=rows[0], old=prior.get(k);
    if (old) {
      decisions.push({kind:stable(old)===stable(r)?'repeat':'same_key_update_review',key:k,receivedRows:rows.length});
      continue;
    }
    // Even a species/location change on a shared checklist is ambiguous. Do not
    // guess which prior observation it replaces, or count it as an accepted addition.
    const overlaps = previous.filter(p=>r.checklistId && p.checklistId===r.checklistId);
    decisions.push({kind:overlaps.length?'identity_review':'new_record_review',key:k,possiblePriorKeys:overlaps.map(key),receivedRows:rows.length});
  }
  for (const [k] of prior) if (!groups.has(k)) decisions.push({kind:'missing_unverified',key:k});
  return decisions;
}
