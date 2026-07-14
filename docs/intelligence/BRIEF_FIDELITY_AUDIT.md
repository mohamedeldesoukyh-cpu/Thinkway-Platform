# Brief → Studio Fidelity Audit (Degradation Report)

**Date:** 2026-07-14 · **Method:** the real production extractors and derivers were executed
in-process on a brief reconstructed from the observed campaign (L'Oréal Paris · Revitalift
Clinical Vitamin C Serum · Egypt · Egyptian women 25–40 · Instagram + TikTok · 6 weeks ·
beauty creators, skincare specialists, dermatologists, luxury lifestyle creators). Every
degraded value observed in the Studio was **reproduced exactly**, with the producing function
identified. No code was changed.

Classification legend: **extracted** (read from brief) · **derived** (computed from extracted
facts) · **benchmarked** (industry constant presented as benchmark) · **inferred** (guessed
from signals) · **defaulted** (hardcoded fallback) · **fabricated** (canned string presented
as evidence).

---

## 1. Field-by-field provenance (Campaign Summary card)

| Studio field | Displayed value | Producing function | Classification | Stored confidence | Fidelity verdict |
|---|---|---|---|---|---|
| Client / Brand | L'Oréal Paris | `parseBrandFromText` — **hardcoded whitelist** (`Coca-Cola\|BabyJoy\|Adidas\|Emirates NBD\|Visit Egypt\|Rolex\|Pepsi\|L'Oréal`) | extracted (by luck) | 0.9 | ✅ Correct **only because L'Oréal is in the demo whitelist.** Any brand outside 8 names depends on fragile "campaign for X" capture. |
| Budget | 2,000,000 EGP | `parseBudgetTotalFromText` (+ governance clarification) | extracted | 0.92 | ✅ Faithful. |
| Duration | 6 weeks | `parseDurationFromText` | extracted | 0.9 | ✅ Faithful. |
| Platforms | Instagram, TikTok | `extractPlatforms` (keyword scan) | extracted | 0.9 | ✅ Faithful. |
| Market | Egypt | `extractGeography` (known-geo list) | extracted | 0.85 | ✅ Faithful. |
| **Campaign Type** | "Brand prestige & aspiration" | `getIndustryProfile(industry).campaignType` — hardcoded template string | **defaulted** (industry template) | 0.75 | ❌ Never read from the brief. The brief asked for a **product launch** (awareness → consideration → purchase intent). |
| **Audience** | **"Audience"** (the literal word) | `parseAudienceFromText` — `/target[:\s]+(.+?)(?:\n\|$)/` captures the 2nd word of the heading "Target **Audience**" and never reads the next line | extracted (garbage) | **0.88** | ❌ Total loss of "Egyptian women aged 25–40, urban, skincare-involved". High-confidence garbage: a heading fragment stored as a brief-sourced fact. |
| **Product** | "as a premium skincare solution." | `parseProductFromText` — first pattern matches only `*-diapers` (BabyJoy fixture); fallback `/product[:\s]+/` matches the word "product" **mid-sentence** and captures the tail of the sentence | extracted (garbage) | 0.85 | ❌ "Revitalift Clinical Vitamin C Serum" — the actual SKU being launched — is never captured anywhere. |
| **Objective** | Launch sentence (their run) / "Brand awareness and engagement" (no label) | `parseObjectiveFromText` — requires a literal `Objective:` label; otherwise hardcoded default | extracted-or-defaulted | 0.9 / 0.5 | ⚠️ One line max. "Consideration" and "purchase intent" survive only inside the sentence text; they are never structured, so KPI derivation can't see them. |
| **Estimated Reach** | "2.5M–4M qualified impressions" | `INDUSTRY_PROFILES.luxury.estimatedReach` — a hardcoded string | **benchmarked (fake)** | n/a | ❌ Not computed from budget (2M EGP), CPM, or creator roster. Same string for a 100K and a 100M campaign. |
| **Creator Mix** | "Macro + Celebrity · editorial quality" | `INDUSTRY_PROFILES.luxury.creatorMixSummary` — hardcoded string | **defaulted** (industry template) | n/a | ❌ The brief's explicit creator ask (beauty creators, skincare specialists, **dermatologists**, luxury lifestyle) is not stored in CampaignFacts at all — there is no field for it. |

## 2. The industry misclassification that poisons everything downstream

`detectIndustryFromBrief` (industry-intelligence.ts:34-61) supports exactly **six demo
verticals + general**: luxury (Rolex), tourism (Visit Egypt), baby (BabyJoy), retail
(Adidas/Pepsi), telecom (e&), finance (Emirates NBD). **There is no beauty/skincare
industry.** The brief's phrase "**luxury** lifestyle creators" matched `/luxury/` →
industry = `luxury` → the entire campaign inherited the **Rolex demo template**:

- Campaign Type "Brand prestige & aspiration"
- Creator Mix "Macro + Celebrity · editorial quality"
- Estimated Reach "2.5M–4M qualified impressions"
- Platform default `["Instagram","YouTube"]`
- Luxury budget weights, `$18–$32 CPM`, `$0.45–$0.85 CPE`
- Luxury KPI set, luxury risk templates, luxury success-probability base

One keyword in the *creator ask* reassigned the whole campaign's vertical.

## 3. Requested creator types: dropped at the schema level

`CampaignFacts` has **no field** for requested creator categories/specialties. The brief's
"beauty creators, skincare specialists, dermatologists, luxury lifestyle creators":

- never reaches the Studio Creator Mix section (which renders the industry TIER template:
  Celebrity 15% / Macro 35% / Mid 30% / Micro 15% / Nano 5% — `getIndustryCreatorMix("luxury")`);
- never reaches the Director strategy (`creatorTierStrategy` is tiers only: Macro 40 / Micro 35 / Nano 25);
- reaches creator discovery **only** via the separate LLM-extracted Campaign Intelligence
  Profile (`creatorCategories`/`creatorNiches` → search filters). Two extraction systems run
  on the same brief (regex facts for the Studio, LLM CIP for discovery) and are never reconciled —
  the Studio displays the weaker one.

## 4. KPI funnel collapse

`extractKpis` derives KPIs from the **objective string**. With consideration/purchase-intent
unstructured, the funnel collapses to one default: `Reach: confirm target with brand`.
Conversion KPI is added only if `/conversion|sales|leads?/` appears in the objective string —
"purchase intent" doesn't match. The brief's 3-stage funnel (awareness → consideration →
purchase intent) becomes a single reach KPI.

## 5. Fabricated evidence presented as grounding

`getGroundedKpis` (industry-intelligence.ts:731-758) attaches canned citations per industry:

> "Based on **47 similar luxury campaigns** in MENA with HNW targeting" · calculationSource:
> "47 historical campaigns" · confidence: 88

The number 47 is a **hardcoded constant** (`similarCampaigns: {luxury: 47, tourism: 83, baby: 124, …}`).
No historical campaign data is consulted. The same applies to success probability inputs and
"Industry Benchmark" reasons. These strings render in the Studio as evidence with confidence
scores — the most severe fidelity violation found: not information loss but **information
invention**.

## 6. Confidence system does not measure fidelity

`setField` stores whatever a regex captured with a fixed confidence (audience 0.88, product
0.85, "brief" source) — the garbage captures above carry *higher* confidence than honest
defaults. `validateCampaignFacts` did not reject "Audience" (a heading fragment) or
"as a premium skincare solution." (a sentence tail). Confidence currently encodes *which
regex fired*, not *whether the value is faithful to the brief*.

## 7. Degradation map (where information is lost, stage by stage)

```
BRIEF ──► extractCampaignFacts (regex)      LOSS #1  audience → heading fragment "Audience" (0.88)
   │                                        LOSS #2  product → sentence tail; SKU never captured (0.85)
   │                                        LOSS #3  objective → 1 line max or hardcoded default
   │                                        LOSS #4  creator types → NO SCHEMA FIELD, silently dropped
   │                                        LOSS #5  funnel (consideration/purchase intent) → unstructured
   │
   ├──► detectIndustryFromBrief (6 demo verticals)
   │                                        LOSS #6  beauty/skincare → "luxury" via the word "luxury"
   │                                                 in the creator ask; entire template chain wrong
   │
   ├──► getIndustryProfile template         LOSS #7  campaignType/creatorMix/estimatedReach/platform
   │                                                 defaults/budget weights/CPM = Rolex demo constants
   │
   ├──► writeStrategyDocumentFromBrief      LOSS #8  understanding.audience/objective inherit LOSS #1/#3;
   │    + extractKpis                                KPIs collapse to a single default reach KPI
   │
   ├──► specialists / summaryCards          faithful to facts — they propagate the losses verbatim
   │    (applyFactsToSummaryData)                    (no new loss, no recovery)
   │
   ├──► getGroundedKpis / success prob.     LOSS #9  fabricated "N historical campaigns" citations +
   │                                                 canned confidence scores presented as evidence
   │
   └──► CIP (LLM extraction, discovery only)LOSS #10 dual extraction: the richer LLM understanding
                                                     exists but never reaches the Studio fields
```

**Faithful fields (no loss):** brand (whitelist luck), budget, duration, platforms, market.
**Everything else displayed prominently in the Studio is template, default, or mis-capture.**

## 8. Root cause (single sentence)

The Studio's "intelligence" fields are produced by demo-fixture regexes and six hardcoded
industry templates built for the sprint demo briefs (BabyJoy, Rolex, Adidas, e&, Emirates NBD,
Visit Egypt); any brief outside those fixtures degrades to the nearest template, while the
richer LLM extraction that already exists (Campaign Intelligence Profile) is used only for
creator search and never for the Studio's displayed fields.

*Report only — no fixes implemented, per instruction.*
