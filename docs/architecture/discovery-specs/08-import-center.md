# 8 · Import center

**Route:** `/discovery/import` · **`PG='imp'`** · function `pgImport()`
**Prerequisite:** `00-FOUNDATION.md`. **Owns no overlays.** Standalone — build any time after step 0.

---

## Track list — 11 columns

```js
const C='34px minmax(190px,1.4fr) 130px 116px 84px 96px 92px 92px 88px 138px 92px';
```

`grid(C, 1340, H, rows, foot)`

## Header

```
☐ · Filename · Source · Status · Type · Creators · Imported · Updated · Failed · Created · Act
```

`Creators`, `Imported`, `Updated`, `Failed` and `Act` are right-aligned.

## Data — 5 rows

```js
const IMP=[
 ['creator 34 Travel.pdf','',            'Completed','PDF', 577, 438,139,  0,'Jul 2, 2026','16:07'],
 ['agency_batch_q3.xlsx','Ogilvy',       'Completed','XLSX',1204,1180, 24, 0,'Jul 2, 2026','15:41'],
 ['tiktok_export.csv','TikTok',          'Completed','CSV',  860, 802, 41,17,'Jul 1, 2026','11:20'],
 ['bundle_avatars.zip','Bundle Plus',    'Processing','ZIP', 432, 210,  0, 0,'Jul 1, 2026','09:58'],
 ['fashion_list.csv','',                 'Failed','CSV',      96,   0,  0,96,'Jun 30, 2026','18:12']];
// [filename, source, status, type, creators, imported, updated, failed, date, time]
```

Row class: `bad` when `failed>0 || status==='Failed'`, `wrn` when `Processing`, else `''`.
So rows 3 and 5 get the red inset bar, row 4 the amber one.

## Cell rendering

| Column | Render |
|---|---|
| Filename | `.tw-nm` with `title` — filenames contain spaces and truncate |
| Source | `.tw-t`, or **`not tagged`** in `.tw-miss` when empty (rows 1 and 5) |
| Status | `.tw-p` — `p-g` Completed · `p-y` Processing · `p-r` Failed |
| Type | `.tw-cc` — PDF / XLSX / CSV / ZIP |
| Creators | `.tw-v` |
| Imported | `.tw-v pos` |
| Updated | `.tw-v`, `.z` when 0 |
| Failed | `.tw-v neg`, `.z` when 0 |
| Created | `.tw-d` → `02 Jul 26 · 16:07` |
| Act | `Retry` when the row is bad, else `View` |

**`.z` on a zero is the point.** A zero in Failed is good news and must not draw the eye the way 96
does; a zero in Updated is neutral. Same glyph, different weight.

## Upload panel — above the grid

`grid-template-columns:minmax(0,1fr) 220px`, 12px gap.

**Left — drop zone** (`.tw-drop`):

> ↑ **Drag and drop creator datasets**
> .PDF · .XLSX · .CSV · .ZIP — ZIP bundles may contain CSV or XLSX plus optional avatar images.
> Multiple files, up to 50 MB each.
> **[Browse files]**

**Right:** `Source name (optional)`, placeholder `e.g. Ogilvy, TikTok`, hint:
*"Tag uploads with the dataset provider so history can be filtered later. One of the five below is
untagged."*

The hint points at real rows. A generic "optional" gets ignored; naming the consequence gets the
field filled.

## The warning that must not be dropped

```
Uploads process automatically and source files are removed after import — only the filename and row
counts stay in history. Download the original before uploading if you need it.
```

`.tw-note wrn`, above the grid, before the user drops anything. This is destructive and irreversible
and the live platform says it nowhere.

## Footer and conflict note

Footer totals: Creators **3,169** · Imported **2,630** (`pos`) · Updated **204** · Failed **113** (`neg`).

Under the grid, a conflict note:

```
113 creators failed to import and 1 file failed outright.
```

Masthead says `Imported 2,630` — which is true and is also 83% of what was uploaded. Both numbers
belong on screen; a success count without its failure count is the kind of half-truth the honesty
rules exist to stop.

## Masthead

```
Uploads 50 · Creators 3,169 · Imported 2,630 (g) · Updated 204 · Failed 113 (r) · Processing 1 (y)
```

## Acceptance

- [ ] Track list byte-identical.
- [ ] Rows 3 and 5 carry the red inset bar; row 4 amber.
- [ ] Untagged sources render `not tagged`, never blank.
- [ ] Zeros render `.z` (muted); 96 in Failed renders `neg`.
- [ ] Failed rows offer **Retry**; completed rows offer **View**.
- [ ] File-deletion warning present above the grid.
- [ ] Footer totals: 3,169 / 2,630 / 204 / 113 — verify by summing the array, not by hand.
- [ ] Conflict note present.
- [ ] Class-coverage script passes.
