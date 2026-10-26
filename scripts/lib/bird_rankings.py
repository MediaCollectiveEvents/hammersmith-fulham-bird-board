"""Private archive -> strictly species-level aggregates. No network or writes."""
import csv
import hashlib
import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path


def table(path, required):
    with Path(path).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream, strict=True)
        if not set(required).issubset(reader.fieldnames or []):
            raise ValueError('Missing required source columns')
        rows = list(reader)
    if not rows or any(None in row or None in row.values() for row in rows):
        raise ValueError('Empty or malformed source table')
    return rows


def iso(value):
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError('Invalid observation date')
    return date.fromisoformat(value).isoformat()


def unique(rows):
    result = {}
    for row in rows:
        name = row['COMMON NAME'].strip()
        if not name or name in result:
            raise ValueError('Blank or duplicate public/calendar name')
        result[name] = row
    return result


def build(archive, public, calendar, metadata):
    public_rows = unique(table(public, ['COMMON NAME', 'records', 'first_record', 'last_record', 'borough_rank', 'primary_category']))
    calendar_rows = unique(table(calendar, ['COMMON NAME', 'movement_type']))
    meta = json.loads(Path(metadata).read_text())
    if set(public_rows) != set(calendar_rows):
        raise ValueError('Calendar/public universe mismatch')
    if (meta.get('expected_board_status') != 'READY'
            or meta.get('validation_passed') is not True or meta.get('reconciliation_passed') is not True
            or meta.get('public_species_count') != len(public_rows)
            or meta.get('calendar_species_count') != len(public_rows)):
        raise ValueError('Seasonality is not READY and reconciled')
    observations = defaultdict(list)
    scientific = defaultdict(set)
    seen = set()
    raw = table(archive, ['COMMON NAME', 'SCIENTIFIC NAME', 'OBSERVATION DATE', 'GLOBAL UNIQUE IDENTIFIER', 'APPROVED'])
    for row in raw:
        name = row['COMMON NAME'].strip()
        if not name:
            raise ValueError('Blank archive name')
        if name not in public_rows:
            continue
        identity = row['GLOBAL UNIQUE IDENTIFIER'].strip()
        if not identity or identity in seen:
            raise ValueError('Missing or duplicate archive identity')
        seen.add(identity)
        if row['APPROVED'] != '1':
            raise ValueError('Unapproved in-scope archive record')
        day = iso(row['OBSERVATION DATE'])
        latin = row['SCIENTIFIC NAME'].strip()
        if not latin:
            raise ValueError('Missing scientific name')
        scientific[name].add(latin)
        observations[name].append(day)
    taxa = []
    categories = {'Top 25', 'General Species', 'Current Notable', 'Borough Mega', 'Borough Ghost', 'Most Wanted'}
    movements = {'Resident', 'Summer Visitor', 'Winter Visitor', 'Partial Migrant', 'Passage Migrant', 'Scarce / Irregular'}
    for name, row in public_rows.items():
        days = observations[name]
        if len(scientific[name]) != 1 or not days:
            raise ValueError('Missing or ambiguous taxon evidence')
        if (len(days) != int(row['records']) or min(days) != iso(row['first_record'])
                or max(days) != iso(row['last_record'])):
            raise ValueError('Archive/public count or date mismatch')
        if row['primary_category'] not in categories or calendar_rows[name]['movement_type'] not in movements:
            raise ValueError('Unsupported source classification')
        taxa.append(dict(commonName=name, scientificName=next(iter(scientific[name])), records=len(days),
                         firstRecorded=min(days), lastRecorded=max(days), category=row['primary_category'],
                         movementType=calendar_rows[name]['movement_type']))
    taxa.sort(key=lambda row: (-row['records'], row['commonName']))
    for rank, taxon in enumerate(taxa, 1):
        if int(public_rows[taxon['commonName']]['borough_rank']) != rank:
            raise ValueError('Public rank disagrees with canonical tie-break')
        taxon['rank'] = rank
    reference = max(row['lastRecorded'] for row in taxa)
    start = (date.fromisoformat(reference) - timedelta(days=364)).isoformat()
    recent = [dict(commonName=t['commonName'], records=sum(start <= d <= reference for d in observations[t['commonName']]),
                   allTimeRank=t['rank']) for t in taxa]
    recent.sort(key=lambda r: (-r['records'], r['commonName']))
    for i, row in enumerate(recent, 1):
        row['recentRank'] = i if row['records'] else None
        row['rankChange'] = row['allTimeRank'] - i if row['records'] else None
    seasonal = {}
    for month in range(1, 13):
        rows = []
        for t in taxa:
            days = [d for d in observations[t['commonName']] if int(d[5:7]) == month]
            rows.append(dict(commonName=t['commonName'], records=len(days), yearsWithRecords=len({d[:4] for d in days})))
        rows.sort(key=lambda r: (-r['records'], r['commonName']))
        for i, row in enumerate(rows, 1):
            row['rank'] = i if row['records'] else None
        seasonal[str(month)] = rows
    least = [dict(commonName=t['commonName'], records=t['records'], rank=i)
             for i, t in enumerate(sorted(taxa, key=lambda t: (t['records'], t['commonName'])), 1)]
    rising = sorted(recent, key=lambda r: (r['rankChange'] is None, -(r['rankChange'] or 0), -r['records'], r['commonName']))
    return dict(schemaVersion=1, source='eBird borough archive', generatedAt=meta['generated_at'],
                archiveRange=dict(first=min(t['firstRecorded'] for t in taxa), last=reference),
                coverage=dict(taxonCount=len(taxa), recordCount=len(seen), sourceRecordCount=len(raw), excludedRecordCount=len(raw)-len(seen)),
                recentWindow=dict(start=start, end=reference, days=365),
                fingerprints={key: hashlib.sha256(Path(p).read_bytes()).hexdigest() for key, p in
                              [('archive', archive), ('publicLayer', public), ('calendar', calendar), ('metadata', metadata)]},
                availableViews=['borough', 'recent', 'rising', 'leastRecorded', 'seasonal'],
                rankings=dict(borough=taxa, recent=recent, rising=rising, leastRecorded=least, seasonal=seasonal, hotspots=[]))


if __name__ == '__main__':
    try:
        result = build(*sys.argv[1:])
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, KeyError, TypeError, OSError) as error:
        raise SystemExit(str(error))
