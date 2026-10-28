# Approved photographic library — 28 October 2026

The user exported 127 decisions: 117 approvals and ten rejections. Each approved
scientific/common identity, Commons source page and file title was reconciled to
the sourced catalogue. There are no duplicate approved source files. The public
audit `bird-photo-approvals.json` contains the approved decisions and rejected taxon
names; unreviewed alternatives and rejected source-image URLs remain local.

Production coverage is **121/133 taxa**: four previously verified photographs plus
117 user-approved photographs. Ten rejected taxa and both hybrid entries retain
placeholders. No parental images or alternative unapproved files are substituted.
The original source workbook and unreviewed photo catalogue are not deployment inputs.

The 242 local WebP files total **9,853,298 bytes** (about 9.9 MB / 9.4 MiB). The
117 bounded thumbnail downloads total 17,661,745 bytes in temporary local storage;
no large originals were requested. Photos are converted at quality 83 into 800px
and 400px bounding boxes with preserved aspect ratio and no crop/upscaling. Source
SVG flight outlines are unchanged. Image dimensions are read from decoded files;
responsive srcset descriptors use actual widths, including portrait images.

Supported licence distribution across all 121 photographs:
CC BY-SA 4.0: 32; CC BY-SA 3.0: 29; CC BY 2.0: 22; CC BY-SA 2.5: 14;
CC BY-SA 2.0: 9; CC BY 4.0: 8; CC BY 3.0: 4; CC BY 2.5: 3.
Every image retains creator, source title/page, licence/version/URL, attribution,
modification notice and verification evidence. New evidence explicitly records
human approval and metadata reconciliation; it does not claim a second biological
review by the agent. Adapted images retain the named source licence, including
share-alike obligations. Manifest and visitor-visible credits provide the links.
No noncommercial, no-derivatives or unknown-rights candidates were promoted.

Rejected taxa: Common Murre, European Pied Flycatcher, Green-winged Teal, Little
Gull, Mandarin Duck, Mediterranean Gull, Northern Wheatear, Red-crested Pochard,
Western Marsh Harrier and Western Yellow Wagtail. Exact identities are retained
in the approval audit. Both hybrid taxa remain separate manual-review entries.

Validation: local full review-branch suite **146/146 passes** (including unpublished
candidate-gallery tests). All 242 files decode and match bounded dimensions in
Pillow. Browser checks at 1440px/390px confirm 121 listing thumbnails and 12 missing
photo labels with search/card/download interactions retained. A browser loads and
decodes every one of the 121 thumbnails, checks three new full card photos and
credits, and confirms a rejected species retains its placeholder. Production test
coverage is reported separately because unreviewed catalogue tests stay local.

No eBird ingestion, archive identities, ranking definitions, refresh architecture,
ADR or publication workflows change. Existing imagery remains local to GitHub
Pages; visitors do not call Wikimedia or eBird APIs when opening cards.

Production-only validation: **143/143 tests pass** with no unreviewed candidate
catalogue, gallery, raw review export, original source workbook or their local Git
history included in the deployment branch. Only the approved-image audit and
rejected taxon names are retained publicly.
