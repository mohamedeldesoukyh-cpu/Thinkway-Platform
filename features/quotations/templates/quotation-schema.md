# Thinkway Quotation Template — Data Schema & Integration Guide

One Handlebars template (`quotation-template.html`) renders all four quotation
variants. Behaviour is driven by a `flags` block; every other value is a plain
data field. Give this file + the template + `quotation-sample.json` to Cursor.

Rendering engine: **Handlebars** (`{{value}}`, `{{#each}}`, `{{#if}}`). Any
Handlebars-compatible runtime works (handlebars.js, Node, etc.). If the platform
is React, port the `{{#if flags.*}}` blocks to conditional JSX and the `{{#each}}`
blocks to `.map()` — the field names below are the prop contract either way.

---

## 1. The four variants → flags

Set these from the quotation's export type. Everything else in the template is
identical across variants.

| Export type            | `showcaseCreators` | `showCommercialSummary` | `pricing`    | `itemizedPricing` | `showFees` | `includeTerms` | `includeAcceptance` |
|------------------------|:---:|:---:|--------------|:---:|:---:|:---:|:---:|
| **standard**           | false | true  | `"itemized"` | true  | true  | true | true |
| **lump_sum**           | false | true  | `"lump_sum"` | false | false | true | true |
| **showcase**           | true  | false | `"none"`     | false | false | false | false |
| **showcase_lump_sum**  | true  | true  | `"lump_sum"` | false | false | true | true |

Notes:
- `itemizedPricing` is just `pricing === "itemized"` — precompute it so the template stays logic-free.
- `showFees` shows/hides the price column inside showcase deliverable tables (kept false for all current showcase exports).
- The **showcase** export in your samples ends at the roster (no commercial summary, terms, or acceptance). Flags above reproduce that. Flip `includeTerms`/`includeAcceptance` to `true` if you want them.
- Section numbers (the little navy `01/02/…` badges) are data, not computed — see `sectionNo` fields — because they shift per variant. Set them when you assemble the payload (mapping below).

### Cover third stat (`cover.stat3`) by variant
| Variant | label | value / valueShort source |
|---|---|---|
| standard | `Client Investment` | `commercial.totalInclAF` |
| lump_sum | `Total Cost` | `commercial.totalInclAF` |
| showcase_lump_sum | `Total Cost` | `commercial.totalInclAF` |
| showcase | `Est. Engagement` | `campaign.estEngagement` |

---

## 2. Placeholder → quotation field mapping

`{{path}}` in the template ← where it comes from in your quotation model.

### quotation (cover meta)
| Placeholder | Quotation field | Example |
|---|---|---|
| `quotation.number` | `quotation.reference` | `QT-2026-0012` |
| `quotation.title` | `quotation.title` | `E& Summer Campaign Song` |
| `quotation.client` | `client.name` | `Essencemediacom` |
| `quotation.brand` | `campaign.brand` | `E&` |
| `quotation.preparedBy` | `quotation.owner.displayName` | `mohamedeldesouky` |
| `quotation.issueDate` | `quotation.issuedAt` (fmt `DD MMM YYYY`) | `14 Jul 2026` |
| `quotation.validUntil` | `quotation.validUntil` (fmt `DD MMM YYYY`) | `29 Jul 2026` |
| `quotation.version` | `quotation.version` | `v1.0` |
| `quotation.status` | `quotation.status` (uppercase) | `DRAFT` |

### cover
| Placeholder | Source | Example |
|---|---|---|
| `cover.kicker` | derived from export type | `Client Quotation` · `Client Quotation · Lump Sum` · `Client Quotation · Showcase` |
| `cover.subtitle` | static or `quotation.subtitle` | `Influencer marketing proposal prepared exclusively for {{client}}.` |
| `cover.stat3.label` | see variant table above | `Client Investment` |
| `cover.stat3.value` | full currency string | `3,499,999.92 EGP` |
| `cover.stat3.valueShort` | abbreviated | `E£3.50M` |

### campaign (headline metrics)
| Placeholder | Quotation field | Example |
|---|---|---|
| `campaign.creatorCount` | `campaign.creators.length` | `13` |
| `campaign.tierSummary` | derived | `across 4 tiers` |
| `campaign.estReach` | `campaign.estimatedReach` (thousands-sep) | `15,791,000` |
| `campaign.estReachShort` | abbreviated | `15.79M` |
| `campaign.estEngagement` | `campaign.avgEngagementRate` (%) | `13.07%` |

### categories[] (loop — Section 01 cards)
| Placeholder | Field | Example |
|---|---|---|
| `name` | `category.name` | `Lifestyle` |
| `count` | `category.creatorCount` | `10` |
| `countLabel` | derived (`{n} creator[s]`) | `creators` |
| `share` | `category.sharePct` | `76.9%` |

### tiers[] (loop — tier breakdown)
| Placeholder | Field | Example |
|---|---|---|
| `name` | `tier.label` | `Celebrity` |
| `slug` | lowercased label → css class | `celebrity` \| `mega` \| `macro` \| `mid` \| `unknown` |
| `profileCount` | derived | `1 profile` / `2 profiles` |
| `followers` | `tier.followers` (short) | `6.2M` |
| `estReach` | `tier.estReach` (short) | `3.4M` |
| `reachShare` | `tier.reachSharePct` | `42.8%` |
| `avgER` | `tier.avgER` | `1.54%` |
| `creators[]` | `tier.creators` | — |
| ↳ `handle` | `creator.handle` | `yourfavlillyxox` |
| ↳ `platform` | `creator.primaryPlatform` | `TikTok` |
| ↳ `followers` | `creator.followers` (short) | `6.2M` |
| ↳ `category` | `creator.categories.join(', ')` | `Lifestyle` |
| ↳ `er` | `creator.engagementRate` | `1.54%` |
| ↳ `estReach` | `creator.estReach` (short) | `3.4M` |

### totals (grand-total bar)
| Placeholder | Field | Example |
|---|---|---|
| `totals.creatorCount` | `campaign.creators.length` | `13` |
| `totals.followers` | sum, short | `15.8M` |
| `totals.estReach` | sum, short | `8.0M` |
| `totals.avgER` | weighted avg | `13.07%` |

### insight
| Placeholder | Source | Example |
|---|---|---|
| `insight.categoryMix` | derived sentence | `Category mix — Lifestyle 10 · Beauty 3 · Fitness 3 · Travel 1.` |
| `insight.tierMix` | derived sentence | `Tier mix — Mid 5 · Macro 3 · Mega 2 · Celebrity 1.` |
| `insight.scale` | derived sentence | `Scale — 13 creators delivering an estimated reach of 15,791,000 at an average ER of 13.07%.` |

### commercial (Section 02)
| Placeholder | Field | Example |
|---|---|---|
| `commercial.sectionNo` | `02` (standard/lump) · `09` (showcase_lump_sum) | `02` |
| `commercial.headlineLabel` | `Client investment` (itemized) · `Lump sum cost` (lump) | `Client investment` |
| `commercial.headlineValue` | matching currency string | `E£3,499,999.92` |
| `commercial.subtotalLabel` | `Client cost` (itemized) · `Lump sum cost` (lump) | `Client cost` |
| `commercial.subtotalValue` | currency | `E£3,499,999.92` |
| `commercial.agencyFee` | `commercial.agencyFee` | `E£0.00` |
| `commercial.totalInclAF` | `commercial.grandTotal` | `E£3,499,999.92` |
| `commercial.lumpSumNote` | static blurb (lump variants only) | `Deliverables below are covered by a single lump-sum fee; individual creator pricing is not itemized.` |

### feeLines[] (Section 02 rows)
Used by **itemized** (with `grossFee`) and **lump_sum** (without `grossFee`).
| Placeholder | Field | Example |
|---|---|---|
| `creator` | `line.creatorHandle` | `cheroukcherif` |
| `tier` | `line.tier` | `Macro` |
| `platform` | `line.platform` | `TikTok` |
| `deliverable` | `line.deliverable` | `1× TT Video` |
| `grossFee` | `line.grossFee` (itemized only) | `187,500.00` |

### showcaseCreators[] (one page each — showcase variants)
| Placeholder | Field | Example |
|---|---|---|
| `sectionNo` | running badge no. (`02`,`03`…) | `02` |
| `index` | 1-based position | `1` |
| `initials` | first 2 letters of handle, uppercase | `HA` |
| `name` | `creator.displayName` or handle | `@hanyellethyy` |
| `handle` | `@handle` | `@hanyellethyy` |
| `followers` | short/full | `136,100` |
| `engagement` | `creator.engagementRate` | `56.80%` |
| `tier` | `creator.tier` | `Mid` |
| `categories` | joined | `Lifestyle` |
| `platforms` | joined | `TikTok` |
| `publications[]` | array of image URLs (may be empty) | `["https://…/1.jpg"]` |
| `deliverables[]` | `{ option, service, platform, type, grossFee? }` | — |

### roster[] (showcase summary table)
| Placeholder | Field | Example |
|---|---|---|
| `handle` | `@handle` | `@hanyellethyy` |
| `followers` | number | `136,100` |
| `er` | rate | `56.80%` |
| `tier` | tier | `Mid` |
| `categories` | joined | `Lifestyle` |
| `platforms` | joined | `TikTok` |
| `roster.sectionNo` | badge no. | `09` |

### terms
| Placeholder | Field | Example |
|---|---|---|
| `terms.sectionNo` | badge no. | `03` |
| `terms.items[]` | `{ heading, body }` | — |

### acceptance
| Placeholder | Field | Example |
|---|---|---|
| `acceptance.sectionNo` | badge no. | `04` |
| `acceptance.revision` | `quotation.revisionLine` | `v1.0 · mohamedeldesouky · 14 Jul 2026 — Initial quotation created` |

### company + footer (static, from brand kit)
| Placeholder | Value |
|---|---|
| `company.legalLine` | `Thinkway · CR 57920 · VAT 780-879-732` |
| `company.address` | `44B Saraya Mall, Sheikh Zayed, Giza, Egypt · hello@thinkwaymedia.com` |
| `footer.left` | `Confidential · Thinkway Platform · {{issueDate}}` |

---

## 3. Formatting helpers to implement platform-side
- **Currency:** `E£` prefix + `1,234,567.89` (2 decimals). "Short" = `E£3.50M`.
- **Big numbers short:** `15,791,000 → 15.79M`, `541,400 → 541.4K`.
- **Dates:** `DD MMM YYYY` (`14 Jul 2026`).
- **`slug`:** `tier.label.toLowerCase()` → must be one of `celebrity|mega|macro|mid|unknown` to hit the right tag colour.
- **`initials`:** strip `@`, take first two alpha chars, uppercase.

## 4. Brand tokens (already in template `:root`)
`--blue #0057FF` · `--navy #060810` · `--lav #E8EFFE` · `--ink #0B0F1A` ·
`--muted #6B7280` · gradient `145deg #0040CC→#0057FF→#1A6FFF→#0048DD`.
Fonts: **Geist** (400–800), **Geist Mono** (IDs & figures).

## 5. Orientation
Template is **A4 landscape**. To switch to portrait: change `.page` to
`width:794px; min-height:1123px;` and `@page { size:A4 portrait; }`. Nothing
else needs to change — all grids are responsive.

---

## 6. Thinkway integration notes (Jul 2026)

Implemented in `features/quotations/templates/` as a TypeScript HTML builder
(`quotation-template-html.ts`) — no runtime Handlebars dependency.

### Avatar extensions (not in original Handlebars template)
- **Showcase pages:** `sc-avatar--img` when `avatarUrl` / proxy resolves; initials fallback (`sc-avatar--initials`).
- **Itemized / lump-sum fee tables:** inline `fee-avatar` beside creator handle.
- **Export pipeline:** unchanged — `embedQuotationDocumentAvatars` inlines data URIs before `buildQuotationHtml`; preview uses same-origin `/api/creators/avatar` proxy via `siteOrigin`.

### Schema gaps inferred from `QuotationDocument`
| Template field | Thinkway source | Notes |
|---|---|---|
| `feeLines[].deliverable` | `deliverables` label or `serviceDescription` | Option/type columns merged into deliverable text |
| `showcaseCreators[].publications[]` | `publicationShots[].imageUrl` | Resolved via publication proxy at render time |
| `cover.subtitle` | `preparedForLine` | Reworded to marketing sentence |
| `quotation.status` | `statusLabel` uppercased | Expired → `EXPIRED` |
| Platform icons in fee table | Text platform label | Original Thinkway export used SVG icons; brand template uses text in Platform column |
| Internal audience GP columns | Not in client template | Internal Excel export unchanged; HTML export remains client-facing |
| Notes section | `doc.notes` | Not in brand template — add `flags.includeNotes` if needed |
| Campaign name on cover | `campaignName` | Omitted from metagrid (schema sample also omits) |
