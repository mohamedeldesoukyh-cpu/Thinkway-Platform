# Creator list redesign verification — 30 September 2026

Latest user revision supersedes the country/market presentation checks below: countries are now omitted from every card and the closing summary. Cards have an avatar/name row in the white area, followed by stored category labels. Missing avatars use initials; missing categories are explicitly marked. The original baseline file has no avatar/category fields, so the regenerated baseline uses those fallbacks; the app adapter supplies both from its existing document data. No database records or manifest values were changed.

The portrait shade was removed completely after the same unsupported PDF gradient appeared pink over card images. PDF.js rendering of page 2 now shows untinted portraits and no unsupported-gradient warnings in the revised report. Seven creator-list tests and TypeScript pass. Updated local artifacts: `creator-list-cards-updated.html` and `creator-list-cards-updated.pdf`. Not deployed.

Implementation is local and has not been deployed. Design CSS, templates and deterministic wall script came from `creator-list-fragment.html`. The rendered reference was opened and printed to PDF for visual comparison; its CSS and markup were not copied.

## Baseline and input

The generator remains connected to the app shortlist document pipeline. For reproducible baseline validation, source rows were read independently from the original downloaded `SL-2026-0031-creator-list.html`, then compared with the supplied CSV manifest. The manifest was not used to manufacture the input and was not modified. All 109 baseline rows matched names, handles, URLs, markets and portraits. The manifest's portrait hash is the first 12 hexadecimal characters of SHA-1 over the base64 text, rather than the decoded image bytes.

## Section 8 checklist

| Check | Result on the original 109-creator baseline |
| --- | --- |
| Pagination | Pass: cover + 19 creator pages + closing = 21; N / 21 footers. |
| Creators and links | Pass: 109 creators and all 109 original links, with noopener noreferrer. |
| Platform badges | Pass: 100 Instagram and 9 TikTok, derived from each URL. |
| Indices | Pass: 001–109, no gaps or repeats. |
| Missing data | Pass: 61 Not recorded labels and 7 visible portrait placeholders. |
| Completeness | Pass: closing states 48 of 109 have a market and 7 lack a portrait. There are 13 distinct recorded market values; no whole-list market coverage claim. |
| **Logo** | **Pass: the real reverse Thinkway artwork appears in all 21 positions. The hand-built placeholder SVG appears nowhere.** Original blue/white brand colours are preserved. The asset is embedded once and reused offline. |
| Print | Pass: CSS page size 1600×900 landscape, backgrounds preserved; all pages visually reviewed. Chromium's PDF height rounds to 675.12 points, so a 4/3-scale raster measures 901 pixels high rather than 900. |
| File size | Pass: approximately 19.88 MB versus original 19,762,588 bytes (+0.59%). Portrait wall reuses existing image sources; no duplicate embedded portraits. |
| Repeatability | Pass: fixed-seed wall; two PDF exports produced identical raster pixels on all 21 pages. PDF container metadata need not be byte-identical. |
| CSS coverage | Pass: no markup classes without corresponding shipped styles. |

Additional checks: all 102 portraits are unique and match their baseline creator hashes; decorative wall accessibility attributes; visible accessible placeholders; empty portrait walls hidden; client-logo and no-logo paths; unknown platforms receive no badge. Client assets are embedded for offline use without recolouring.

## Live shortlist drift — not changed to fit the fixture

The authenticated production preview of SL-2026-0031 currently contains 105 creators, not 109. Live membership and portrait hashes were compared against the baseline. These are findings from the existing production export, not a claim that the redesigned generator has been deployed.

| Count | Manifest | Current production export |
| --- | ---: | ---: |
| Creators / links | 109 | 105 |
| Instagram / TikTok | 100 / 9 | 96 / 9 |
| Portraits / missing | 102 / 7 | 105 / 0 |
| Market recorded / missing | 48 / 61 | 45 / 60 |

Four baseline creators are absent: `kamelia_mossad` (002), `monoush90` (071), `farahfattouh` (084), and `rehaabtareq` (099). No additional creator names were found.

Six previously missing portraits are now supplied: `kholodsa3d`, `mayadahhafez`, `freakhomebody`, `mariiamelmasryy`, `daliaragheb_`, and `the.doaasoliman`.

Four previously present portrait hashes differ: Dr.dina muhamad / `dr.dinamuhamad`, Mommy Eats / `the_mommy_eats`, `nourhan3mad_`, and `farahnofal__`. The other 95 live portrait hashes match the corresponding baseline. Several current links point to newer posts; these differences were observed, not repaired or overwritten. Baseline row verification covers all fields; live verification covers membership, portrait hashes and the totals above, not an exhaustive URL/market comparison.

## Preview and Export menu repair

The menu content is portalled outside `.discovery-suite`, so its old scoped styles did not apply. Both menus now use self-contained item styles, separate title/hint lines, fixed format badges and viewport-constrained widths. Desktop and 390-pixel mobile rendering were inspected; export selection invokes the expected callback.

## Validation and artifacts

Eight targeted tests pass across creator-list rendering, shortlist documents and preview downloads. `tsc --noEmit --incremental false` and `git diff --check` pass. Headless Chromium generated the baseline HTML and two PDFs; PDF pages were raster-compared and visually inspected.

Local artifacts are in `.tmp/creator-list-qa/`: `redesign.html`, `redesign.pdf`, `acceptance.json`, `original-diff.json`, `pdf-check.json`, `pdf-montage.png`, and menu screenshots. These large fixture artifacts are excluded from Git.

## Follow-up: PDF viewer colour compatibility

The user's pink-cover screenshot exposed a limitation missed by the initial PDFium visual check. Reproduced in PDF.js: the original layered gradient emits `Unsupported ShadingType: 1` and is painted hot pink (RGB 255,105,180). HTML and PDFium rendered the same original PDF navy.

The shared HTML generator now rasterizes only the navy gradient overlay at runtime, preserving its exact stops and opacity composition, before the existing image-decode print gate. Portrait sources remain reused; text, links and logos remain separate. No portrait data is embedded again in the HTML. PDF.js now renders the regenerated cover and closing page navy (sample RGB 11,10,70 and 5,4,66). Creator counts, links, portrait hashes, missing-data totals and fixed-seed checks still pass; all six creator-list unit tests pass. This compatibility fix remains local, not deployed.
