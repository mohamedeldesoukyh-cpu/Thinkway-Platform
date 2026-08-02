# Release 2.3 — Final Product Stabilization

**Status:** Implemented for Product soak  
**Branch:** `develop`  
**Scope:** No new capabilities · No architecture redesign · Enterprise-quality output only

---

## Priority 1 — Discovery Consumer Migration (ECI)

| Surface | Change |
|---------|--------|
| Creator Cards | Star / score display from `eci_investment_score` via `loadCreatorIntelligenceBundles` |
| Creator Detail | “Investment score” + recommendation (not Thinkway / brand_fit) |
| Compare | Matrix + PDF “Investment Score” from ECI overlay |
| Browse enrich | `browseUnifiedCreatorsAction` / detail / compare stamp ECI overlays |

**SSOT:** `@/lib/enterprise-creator-intelligence` only for investment display.  
Thinkway Score remains Discovery **acquisition ranking** only — never investment SSOT.

---

## Priority 2 — Enterprise Constraint Engine

| Rule | Behavior |
|------|----------|
| Mandatory | Country, platform, language (when present), brand safety, blacklist/legal — **never relaxed** |
| Preferred | Category, engagement, followers, etc. — may relax with report |
| Dual-pool | Relaxed SQL may still fetch broadly; **mandatory violators removed before ranking** |
| Slate | `strictPlatform` — no off-platform fallback on CIP path |
| Progressive search | Stages B/C keep country when known |
| Keyword fallback | Passes geography + platforms from campaign facts |

Relaxations surface on Studio creators `constraintReport` + discovery note (which / why / business impact).

Code: `lib/discovery/enterprise-constraint-engine.ts`

---

## Priority 3 — End-to-end validation (Product soak)

Validate on Development (`dev.thinkwaymedia.com`) after deploy:

1. Brief → CIP (Egypt / Instagram / ER / categories)  
2. Discovery Search Card shows Investment star (ECI) or “—” if no bundle  
3. Creator Detail → Investment score (not Thinkway)  
4. Compare → Investment Score column  
5. Studio create-campaign for **e& Egypt Summer 2026** — recommendations must be Egypt-compliant  
6. Preferred-only relaxation note appears when categories cannot be met  
7. Media Plan / Proposal / Presentation / Campaign Workspace still open (no regression)

Automated: `lib/discovery/enterprise-constraint-engine.test.ts`, view-model, slate `strictPlatform`, ECI freeze-closure.

---

## Not in scope

- New Platform Capabilities  
- ECI calculation redesign  
- Media Plan / Planning Context ownership changes  
- Production deploy (requires explicit approval)
