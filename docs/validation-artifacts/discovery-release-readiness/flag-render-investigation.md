# Country flag render-layer investigation

**Scope:** Discovery exact-row only. No hydration / SQL / DTO / ViewModel changes.  
**Fixture creator:** `countryFlagCodes = ["EG"]` (e.g. `ahmed_elbadawy`).  
**Probes:** `scripts/probe-discovery-flag-render.mjs`, `scripts/probe-discovery-flag-render-full-chain.mjs`  
**Artifacts:** `flag-render-probe.json`, `flag-render-probe-full-chain.json`, PNGs.

---

## Render trace (props → DOM)

```
buildDiscoveryCreatorViewModel(creator)
  → vm.countryFlagCodes = ["EG"]

DiscoveryCreatorExactRow
  → condition: vm.countryFlagCodes.length > 0  ✅ true
  → <span class="discovery-search-exact-flag">
      <CountryFlagsStack countryCodes={["EG"]} size="md" overlay className="size-full" />

CountryFlagsStack (single code)
  → <CountryFlagBadge countryCode="EG" size="md" overlay className="size-full" />

CountryFlagBadge
  → normalizeCountryCode("EG") = "EG"
  → <span aria-label="EG" class="… size-5 size-full …">
      <img src="https://flagcdn.com/w40/eg.png" />
```

Parent positioning context:

```
div.discovery-search-exact-photo-cell
  div.discovery-creator-avatar-hover-trigger.discovery-search-exact-photo-wrap  (position: relative)
    a > CreatorAvatarImage (87×87, overflow:hidden)   // sibling — does not wrap flag
    span.discovery-search-exact-flag                  // position:absolute; z-index:1
    span.discovery-search-exact-star                  // position:absolute; z-index:2
```

---

## Computed metrics (full Discovery overflow chain)

| Node | Box | visibility | opacity | display | overflow | z-index | position |
|---|---|---|---|---|---|---|---|
| `.discovery-search-exact-flag` | **22×22** @ bottom-right of avatar | visible | 1 | block | visible | **1** | absolute |
| Flag badge | 22×22 | visible | 1 | inline-flex | hidden | auto | static |
| Flag `<img>` | 22×22, naturalWidth 40 | visible | 1 | block | clip | auto | static |
| `.discovery-search-exact-star` | ~41×20 centered bottom | visible | 1 | flex | visible | **2** | absolute |
| Avatar | 87×87 | visible | 1 | block | **hidden** | auto | relative |

`elementsFromPoint(flagCenter)` paint stack (pointer-events temporarily enabled):

1. `IMG` flag-img  
2. `SPAN` flag-badge  
3. `SPAN` flag-slot  
4. photo-wrap  

Screenshot confirms Egypt flag visible on avatar rim.

---

## Checklist results

| Check | Result |
|---|---|
| 1. CountryFlagsStack rendering | Renders `CountryFlagBadge` for `["EG"]` — not null |
| 2. Conditional rendering | `length > 0` gate passes when VM has codes |
| 3. CSS visibility | `visibility: visible`, `opacity: 1` |
| 4. Positioning | Absolute bottom-right of photo-wrap — correct |
| 5. z-index | Flag `1` above avatar `auto`; star `2` but **does not cover** flag center |
| 6. Overflow clipping | Shell/workspace `overflow:hidden` ancestors **do not** clip flag bounds |
| 7. Absolute positioning | Containing block = photo-wrap; flag rect non-zero |
| 8. Masking | `clip-path: none`, `mask-image: none` |
| 9. Transform/scale | Flag transform none; star translateX only — no flag scale collapse |
| 10. Parent containers | Avatar `overflow:hidden` is sibling, not parent of flag — does not clip flag |

Star vs flag geometry (measured): star.right **140.2**, flag.left **143** → **no overlap**.

---

## Exact root cause (render layer)

**There is no render-layer defect that hides the flag when `countryFlagCodes = ["EG"]`.**

The Discovery Search exact-row CSS + DOM path paints a visible 22×22 Egypt flag on the avatar rim. Overflow ancestors, z-index, absolute positioning, and CountryFlagsStack conditionals are all healthy for this case.

### What this rules out
- CountryFlagsStack returning null for `["EG"]`
- Conditional `countryFlagCodes.length > 0` failing when VM is populated
- Dashboard/Discovery `overflow-hidden` clipping the badge
- Avatar `overflow-hidden` clipping the badge (flag is a sibling)
- Star pill covering the flag (measured gap ~3px; star does not cover flag center)

### Latent (non-Search) note — not the Search root cause
Shortlist CSS selector:

```css
.shortlist-creator-exact-root .discovery-search-exact-photo-wrap img { width: 84px; height: 84px; … }
```

matches **all** `img` under photo-wrap, including the flag image. That can distort flags on **shortlist** rows only. Discovery Search does not use that selector.

### If flags still appear missing in a live session
Re-check that the inspected row’s React props actually include `countryFlagCodes: ["EG"]` at render time (minority of creators are hydration-empty). For rows that do, DevTools should match this probe — if not, capture the live computed style diff against `flag-render-probe-full-chain.json`.
