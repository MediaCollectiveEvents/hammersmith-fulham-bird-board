import {validateRankings, verifyRelease, selectRows, views} from './bird-rankings-data.mjs';

const root = document.querySelector('#panel-rankings');
const control = id => root.querySelector(`#rankings-${id}`);
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const labels = {borough:'Borough Rankings', recent:'Recent Rankings', rising:'Rising Species', leastRecorded:'Least Recorded', seasonal:'Seasonal Rankings'};
const number = n => n.toLocaleString('en-GB');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let data, page = 0;
const pageSize = 25;
const formatDate = value => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));

function render() {
  const view = control('view').value;
  const month = Number(control('month').value);
  control('month-label').hidden = view !== 'seasonal';
  const rows = selectRows(data, {view, month, search:control('search').value, sort:control('sort').value});
  page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const window = `${formatDate(data.recentWindow.start)}–${formatDate(data.recentWindow.end)} (365 days, inclusive)`;
  const explanations = {
    borough:'Historical archive records, highest first. Equal counts are ordered by the original validated common name; positions are distinct, not evidence of different abundance.',
    recent:`Archive-relative recent records: ${window}. This is not a live last-year borough census. Taxa with zero records have no recent rank.`,
    rising:`Reporting position within ${window}, compared with all-time archive rank. Positive means positions gained; negative means lost. Small samples can move positions considerably. This is not population growth.`,
    leastRecorded:'Historical archive records, fewest first. Equal counts use alphabetical common names. “Least recorded” does not establish biological rarity; existing classifications are retained.',
    seasonal:`${months[month - 1]} observations across all historical years in this archive, including partial years. Records and years with records measure reporting frequency, not abundance or detection probability.`
  };
  control('explanation').textContent = explanations[view];
  const headers = view === 'borough' ? ['Borough rank', 'Taxon', 'Historical records', 'First recorded', 'Last recorded', 'Existing category']
    : view === 'leastRecorded' ? ['Least-recorded position', 'Taxon', 'Historical records', 'Last recorded', 'Existing category']
    : view === 'seasonal' ? ['Month rank', 'Taxon', `${months[month - 1]} records`, 'Years with records', 'Seasonal classification']
    : ['Recent rank', 'Taxon', '365-day records', 'All-time rank', 'Positions gained / lost', 'Last recorded'];
  control('head').innerHTML = `<tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr>`;
  const taxonLabel = rows.length === 1 ? 'taxon' : 'taxa';
  control('caption').textContent = `${labels[view]} · ${number(rows.length)} matching ${taxonLabel}. Scroll the table horizontally on small screens. Sorting changes display order, not canonical ranks.`;
  control('rows').innerHTML = rows.slice(page * pageSize, (page + 1) * pageSize).map(r => {
    const taxon = `<span class="rankings-name">${escape(r.commonName)}</span><span class="latin">${escape(r.scientificName)}</span>`;
    const time = value => `<time datetime="${escape(value)}">${escape(formatDate(value))}</time>`;
    const delta = r.rankChange === null ? 'No recent records' : r.rankChange > 0 ? `+${r.rankChange}` : String(r.rankChange);
    const cells = view === 'borough' ? [r.rank, taxon, number(r.records), time(r.firstRecorded), time(r.lastRecorded), escape(r.category)]
      : view === 'leastRecorded' ? [r.rank, taxon, number(r.records), time(r.lastRecorded), escape(r.category)]
      : view === 'seasonal' ? [r.rank ?? '—', taxon, number(r.records), number(r.yearsWithRecords), escape(r.movementType)]
      : [r.recentRank ?? '—', taxon, number(r.records), r.allTimeRank, delta, time(r.lastRecorded)];
    return `<tr>${cells.map((cell, i) => `<td${i === 0 || i === 2 ? ' class="rankings-number"' : ''}>${cell}</td>`).join('')}</tr>`;
  }).join('') || `<tr><td colspan="${headers.length}">No taxa match that common or scientific name.</td></tr>`;
  control('page-status').textContent = rows.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${number(rows.length)} ${taxonLabel}` : '0 matching taxa';
  control('previous').disabled = page === 0;
  control('next').disabled = (page + 1) * pageSize >= rows.length;
}

async function load() {
  try {
    const read = async name => {
      const response = await fetch(`./data/${name}`, {cache:'no-store'});
      if (!response.ok) throw Error('Missing ranking source');
      return response.text();
    };
    const [json, metadata, calendar] = await Promise.all(['bird-rankings.json', 'seasonality_metadata.json', 'species_migration_calendar.csv'].map(read));
    data = validateRankings(JSON.parse(json));
    await verifyRelease(data, metadata, calendar);
    const taxa = data.rankings.borough;
    const minimum = data.rankings.leastRecorded[0].records;
    const tied = data.rankings.leastRecorded.filter(r => r.records === minimum).length;
    const overview = [
      ['Recorded taxa (includes hybrids)', number(data.coverage.taxonCount)],
      ['Historical observation records', number(data.coverage.recordCount)],
      ['Most recorded taxon', `${taxa[0].commonName} · ${number(taxa[0].records)}`],
      ['Least recorded taxon', `${data.rankings.leastRecorded[0].commonName} · ${number(minimum)} (${tied} tied)`],
      ['Latest archive date', formatDate(data.archiveRange.last)],
      ['Available ranking categories', String(views.length)]
    ];
    control('overview').innerHTML = overview.map(([term, value]) => `<div><dt>${escape(term)}</dt><dd>${escape(value)}</dd></div>`).join('');
    control('coverage').textContent = `${data.source}: ${formatDate(data.archiveRange.first)}–${formatDate(data.archiveRange.last)}. Counts are observation records, not individual birds. Historical coverage and recording effort vary. Source release: ${data.generatedAt}.`;
    control('view').innerHTML = views.map(key => `<option value="${key}">${labels[key]}</option>`).join('');
    control('month').innerHTML = months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    control('month').value = String(new Date().getMonth() + 1);
    control('controls').disabled = false;
    control('display').hidden = false;
    control('error').hidden = true;
    render();
  } catch {
    control('controls').disabled = true;
    control('display').hidden = true;
    control('error').hidden = false;
    control('error').textContent = 'Bird rankings are temporarily unavailable. A matching, validated archive release is required.';
  }
}
for (const id of ['view', 'month', 'sort']) control(id).addEventListener('change', () => {page = 0; render();});
control('search').addEventListener('input', () => {page = 0; render();});
control('previous').addEventListener('click', () => {page--; render();});
control('next').addEventListener('click', () => {page++; render();});
load();
