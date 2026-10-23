#!/usr/bin/env python3
"""Export species-level aggregates only; never publish raw eBird records."""
import csv
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path


def aggregate(public_path, archive_path):
    with open(public_path, newline='', encoding='utf-8-sig') as stream:
        public = list(csv.DictReader(stream))
    names = [row['COMMON NAME'].strip() for row in public]
    if not names or any(not name for name in names) or len(set(names)) != len(names):
        raise ValueError('Public species names must be nonempty and unique')
    records = defaultdict(list)
    with open(archive_path, newline='', encoding='utf-8-sig') as stream:
        for row in csv.DictReader(stream):
            name = row['COMMON NAME'].strip()
            if name in names:
                records[name].append((row['SCIENTIFIC NAME'].strip(), date.fromisoformat(row['OBSERVATION DATE']).isoformat()))
    species = []
    for row, name in zip(public, names):
        evidence = records[name]
        scientific = {latin for latin, _ in evidence}
        if len(scientific) != 1 or '' in scientific:
            raise ValueError('Missing or ambiguous scientific name: ' + name)
        first, last = min(day for _, day in evidence), max(day for _, day in evidence)
        if int(row['records']) != len(evidence) or row['first_record'] != first or row['last_record'] != last:
            raise ValueError('Public layer and archive disagree: ' + name)
        species.append(dict(commonName=name, scientificName=next(iter(scientific)), records=len(evidence), lastRecorded=last))
    species.sort(key=lambda row: row['commonName'].casefold())
    return dict(source='eBird borough archive', taxonCount=len(species), recordCount=sum(row['records'] for row in species),
                dataDateRange=dict(first=min(row['first_record'] for row in public), last=max(row['last_record'] for row in public)),
                attribution=['Source: eBird Basic Dataset borough archive, using the validated public species layer.'],
                notes=['Species-level aggregates only; no observer details, checklist identifiers or coordinates.',
                       'Counts are archive records, not individual birds. Last recorded means the latest observation date in this archive, not a live or complete borough sighting history.',
                       'taxonCount counts named entries in the validated public layer, which includes hybrid entries; it is not a strict species total.'], species=species)


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('Usage: import-ebird-history.py <public.csv> <archive.csv> <output.json>')
    data = aggregate(sys.argv[1], sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(data, indent=2) + '\n')
    print('Exported', data['taxonCount'], 'taxon entries and', data['recordCount'], 'archive records; no raw records published.')
