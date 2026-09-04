# 5 · Creator search

**Route:** `/discovery/search` · **`PG='search'`** · function `pgSearch()`
**Prerequisite:** `00-FOUNDATION.md`, and the **creator profile modal from page 2** — reuse it, do
not rebuild it.
**Owns 3 overlays:** 24-filter panel · selection bar with ⋯ menu · Add-missing-creator dialog.

---

## Track list — 6 columns

```js
const C='34px minmax(210px,1.5fr) 150px 296px 166px 128px';
```

`grid(C, 1180, H, rows, null)`

Checkbox is **34px** here, not 30px — the four Discovery tool pages have a taller row because of the
avatar. Statistics is 296px and feed 166px, same as page 2.

## Header

```
☐ · Creator name · Category · Statistics · Content from feed · Action
```

`Action` right-aligned. Select-all checked when `SSEL.size===POOL.length`.

## Data — 5 creators (`POOL`, a different array from page 2's `CR`)

```js
const POOL=[
 ['ahmed_elbadawy','Ahmed El Badawy','Egypt','🇪🇬',['Fitness','Music'],1,
   909700,22.53,4400000, 1200000,9.18,7900000],
 ['nourhanneeisa','Nourhanne Eissa نورهان عيسي','Egypt · United Arab Emirates','🇪🇬',['Lifestyle'],0,
   767600,0.77,null, 106500,8.87,322500],
 ['itsfarahhosny','Farah Hosny','Egypt','🇪🇬',['Parenting','Fashion'],1,
   189800,15.89,639300, 19500,168.40,390100],
 ['islamfawzy_','ISLAM FAWZY ● اسلام فوزي','Egypt','🇪🇬',['Parenting'],0,
   6200000,1.22,null, 10000000,0.47,719700],
 ['ouda.5','oudou le king','Egypt','🇪🇬',['Fitness','Music'],1,
   183900,8.92,136200, 221500,0.02,290]];
// [handle,name,country,flag,cats,catOverflow, igF,igE,igV, ttF,ttE,ttV]
```

Four of these five exist **only** in `POOL`. `ouda.5` is the single handle also present in `CR`.

> **This is where the last build broke.** The profile modal resolved against `CR` only, so four of
> the five names silently did nothing. Testing `ouda.5` passed and proved nothing. Use the `cr()`
> function from page 4 §Creator lookup, and click **all five** names.

Two data points to preserve, not clean:
- `itsfarahhosny` TikTok engagement **168.40%** — over 100%, from a tiny 19,500 follower base. Real
  and worth surfacing, not clamping.
- `nourhanneeisa` and `islamfawzy_` have `null` IG avg-views → `—`, never `0`.

## Cell rendering

| Column | Render |
|---|---|
| ☐ | `ssel(handle)`, `checked` from `SSEL`. Row gets `.sel` |
| Creator name | `.tw-avx k1–k3` (`i%3+1`) with `ini(name)` + `.fl` country flag; name as `<button>` → `openCr()`; `@handle` in `.hd`; country in `.lo` |
| Category | `.tw-tags` chips + `.m` overflow |
| Statistics | `.tw-stx`, **one row per platform**, `CRP[handle]` if present else IG+TT from the row |
| Content from feed | 3 × `.tw-thumb` 44px |
| Action | `✓ Add to shortlist` (primary) + `✕` dismiss with `aria-label` |

## Toolbar

`.tw-search` 230px `Search creators…` · **`☰ Filters`** (shows `· N` when filters are active) ·
`Refresh metrics` · **`+ Add missing creator`** · `Create list` · `Add to list` (primary).

Card title **Creators · 25**, subtitle *click a name for the full profile — same panel as the shortlist*.

## Masthead

```
Creators 25 · Selected 0 · Platforms 4 · Countries 6 · Avg engagement 9.4% ·
Verified 0 (r) · Lists 26 · Imported 3.1K
```

`Verified 0` is red. Zero verified creators out of 25 is a data-quality problem, not a neutral count.

---

## Overlay A — filter panel · 24 filters in 6 groups

| Group | Filters |
|---|---|
| **Creator** | Search by handle or name *(input)* · Social platform · Category · Creator country · Language · Verification *(seg)* |
| **Search** | Keyword / hashtag · Content language |
| **Audience** | Audience country · Gender *(seg)* · Age range *(range)* · Audience interests |
| **Performance** | Follower range · Custom follower range *(pair)* · Minimum engagement rate *(seg)* · Minimum average views *(input)* |
| **AI intelligence** | Minimum Thinkway score *(seg)* · Brand fit category *(input)* · Source confidence *(pair)* · Min. brand safety score *(input)* |
| **Advanced** | Last post within *(seg)* · Pricing range USD *(pair)* · Exclusivity · Contract status |

### Eight lists are truncated — 51 chips collapsed, 78 expanded

**A third of every option in the product is behind a "Show N more" link.** Facebook, Snapchat and
LinkedIn are not in the platform list until you expand it, so a user filtering for Facebook creators
concludes there are none.

| Filter | Shown | Hidden behind "Show N more" |
|---|---|---|
| Social platform | 4 of 7 | Facebook, Snapchat, LinkedIn |
| Category | 4 of 8 | Travel, Lifestyle, Tech, Gaming |
| Creator country | 6 of 12 | Lebanon, United States, United Kingdom, France, Germany, India |
| Audience country | 6 of 12 | (same six) |
| Language | 6 of 8 | Turkish, Portuguese |
| Content language | 6 of 8 | Turkish, Portuguese |
| Keyword / hashtag | 3 of 5 | #travel, #beauty |
| Audience interests | 4 of 6 | Travel, Photography |

Full option lists:

```
Social platform  Instagram · TikTok · YouTube · X (Twitter) · Facebook · Snapchat · LinkedIn
Category         Beauty · Fashion · Fitness · Food · Travel · Lifestyle · Tech · Gaming
Country (both)   Egypt · United Arab Emirates · Saudi Arabia · Qatar · Kuwait · Jordan ·
                 Lebanon · United States · United Kingdom · France · Germany · India
Language (both)  English · Arabic · French · Spanish · German · Hindi · Turkish · Portuguese
Keyword          #reels · #viral · #fyp · #travel · #beauty
Interests        Beauty & Cosmetics · Fashion · Health & Wellness · Food & Drink · Travel · Photography
Verification     Any · Verified · Unverified
Gender           Any · Male · Female
Age range        Any · 13 · 18 · 25 · 35 · 45 · 55
Follower range   Nano 1k–10k · Micro 10k–100k · Mid 100k–500k · Macro 500k–1M · Mega 1M–5M · Celebrity 5M+
Min engagement   1%+ · 2%+ · 3%+ · 5%+
Thinkway score   40+ · 50+ · 60+ · 70+ · 80+
Last post within Any time · Last 7 days · Last 30 days · Last 90 days · Last 6 months · Last 12 months
Exclusivity      None · Full · Partial
Contract status  Active · Expired · None
```

### Keep the honesty hints — verbatim

- Gender — *"Applied when audience demographic data is available on the creator."*
- Age range — *"Requires enriched audience age distribution (future backend filter)."*
- Follower range — *"Or set a custom range below."*
- Last post within — *"Filters creators with synced recent publication dates when available."*

The age-range note means the filter **does nothing yet**. Leaving that unsaid produces a support
ticket every time someone gets identical results with and without it.

Footer: **Clear everything** · live active-filter count · **Show results**.
Panel is scrollable with `@media(max-height:720px)` handling; `Esc` closes; focus returns to `☰ Filters`.

## Overlay B — selection bar and the ⋯ menu

Same `.tw-selbar` as page 4. Shows **Reach · Platforms · Avg engagement**.

The `⋯` holds **six** actions:

```
Stop refresh · Compare · Export · Share · Generate quotation · AI Match
```

**`Generate quotation` takes a Search selection straight to a priced quotation with no shortlist in
between** — a genuinely useful shortcut currently buried in an overflow menu behind a bare verb. Give
every item a one-line description; nobody discovers an unlabelled verb in a `⋯`.

Select-all selects the **filtered** rows and must say so: `Select all 25 shown`.

## Overlay C — Add missing creator

Paste up to **25** links. Usernames are derived from the URL; existing creators are skipped.

New creators arrive **unenriched** — metrics follow on the next sync. Say this in the dialog, because
otherwise a row of `—` looks like a failed import.

## Acceptance

- [ ] Track list byte-identical; checkbox column is 34px, not 30px.
- [ ] **Click all five creator names — all five open the profile.** This is the check that failed last time.
- [ ] `itsfarahhosny` shows 168.40%, unclamped.
- [ ] Two creators show `—` for IG avg-views, not `0`.
- [ ] Statistics renders one row per platform for every creator.
- [ ] Expand all 8 truncated lists → **78 chips total**. Count them.
- [ ] Facebook, Snapchat, LinkedIn reachable in the platform filter.
- [ ] All four honesty hints present, verbatim.
- [ ] Filter count in the toolbar updates live; **Clear everything** resets it to zero.
- [ ] `⋯` shows six items, each with a description.
- [ ] Select-all says "25 shown", not "all".
- [ ] Class-coverage script passes with the filter panel **open** and the selection bar visible.
