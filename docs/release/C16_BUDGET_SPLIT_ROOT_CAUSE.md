# C16 Budget Split — Root Cause Report

**Date:** 5 July 2026  
**Brief:** `C16.pdf` (user download)  
**Symptom:** Budget Planner splits budget (Creator fees + Production + Amplification + …) despite brief stating **No production** and **No usage rights**.

---

## 1. PDF brief summary

| Field | Value |
|-------|--------|
| **Brand** | BabyJoy Premium Diapers |
| **Market** | Egypt |
| **Budget** | EGP 2,000,000 |
| **Currency** | EGP |
| **Duration** | 6 weeks |
| **Objective** | Awareness and UGC |
| **Audience** | Mothers with babies 0–3 years |
| **Constraints** | **No production.** **No usage rights.** |

**PDF extraction note:** `C16.pdf` is image-based (scanned/layout PDF) — no reliable plain-text layer via `pdf-parse`. Content above is reconstructed from the user complaint, binary hints (`EGP` markers), and the BabyJoy BL-1 fixture pattern. Text fixture for automated tests: `features/campaign-director/fixtures/c16-brief.txt`.

---

## 2. Root cause (exact function)

**File:** `features/campaign-director/services/budget-rules.ts`  
**Function:** `detectBudgetSplitKeywords` (pre-fix)

### Mechanism

1. Brief contains the phrases **"No production"** and **"No usage rights"**.
2. Pre-fix logic used naive regex on `\bproduction\b` and `\busage\s*rights?\b` **without negation awareness**.
3. Both phrases matched as **affirmative split keywords** → `detectBudgetSplitKeywords` returned `Production` + `Usage Rights`.
4. `briefRequiresOptionalCategories()` returned `true`.
5. `buildDirectorBudgetFromStrategy` (line ~114–128) took the **split branch** and called `deriveInfluencerBudgetAllocations()` instead of `buildSingleCreatorFeesAllocation()`.
6. Baby industry profile applied default weights → **55% Creator fees / 15% Content production / 18% Paid amplification / 7% Agency / 5% Contingency**.

### Reproduction (pre-fix)

```
keywords: Production, Usage Rights
allocations: Creator fees 55%, Content production 15%, Paid amplification 18%, Agency coordination 7%, Contingency reserve 5%
```

### Secondary paths (not primary cause for C16)

| Path | Role |
|------|------|
| `extractCampaignFacts` | Did **not** capture "no production / no usage rights" as constraints (pre-fix) — split detection relied only on brief regex. |
| `buildBudgetSectionExtras` | Only normalizes existing allocations; does not re-run split keyword logic. |
| `enrichCampaignObjectWithStudioData` | Rebuilds budget from facts via `buildBudgetSectionDataFromFacts` — **inherits same bug** when strategy absent or when keyword detection fails. |
| `structured-section-builders.buildBudgetSectionData` | LLM line parser could match `/production/i` inside "No production" lines — secondary risk for specialist text output. |

**Primary bug:** `detectBudgetSplitKeywords` false-positive on negated keywords → entire Director/IS-1 budget pipeline chose industry split template.

---

## 3. Why governance layers did not save the user

| Layer | Ran? | Why ineffective for C16 |
|-------|------|-------------------------|
| **CampaignFacts** | Yes | `extractConstraints()` did not record negative production/usage-rights constraints; budget path did not consult them. |
| **Director / Debate (IS-3)** | Yes | Director budget built via `buildDirectorBudgetFromStrategy`, which **trusted false-positive split keywords**. Debate adjusts tier mix, not negation logic. |
| **IS-1 / IS-2 reasoning** | Yes | `budget-planner-reasoning.ts` calls same `detectBudgetSplitKeywords` — propagated split with plausible-sounding rationale. |
| **BL-1 100% rule** | Partially | Rule exists but gated on `splitKeywords.length === 0`; false positives bypass it. BL-1 fixtures did not include a **negated-keyword** brief. |
| **Release 1.1.5 wiring** | Yes | `applyDirectorBudgetRules` → `buildDirectorBudgetFromStrategy` — wiring correct, **input classification wrong**. |
| **Release 1.1.7 governance (QA / IS-2 gate)** | Yes | **IS-2 gate** (`decision-intelligence-gate.ts`): `budget_default_creator_fees` used `optionalSplit \|\| creatorFees >= 95%` — false-positive `optionalSplit` **auto-passed** split budgets. **QA manager** only checked allocations sum to 100%, not whether split was **authorized** by brief. |

**Honest conclusion:** Layers added review depth (rationale, totals, timeline) but shared a single brittle classifier. No layer asked: *"Does the brief forbid the lines we're adding?"*

---

## 4. Fix applied

**Scope:** Business logic only — architecture frozen.

### 4.1 `budget-rules.ts`

- Added `BUDGET_SPLIT_NEGATIVE_PATTERNS` for negated phrases: `no production`, `without production`, `no usage rights`, coordinated forms (`without production or usage rights`), etc.
- Added `hasAffirmativeSplitKeyword()` — per-match negation check before counting a keyword.
- Added `briefForbidsBudgetSplit()` — explicit helper for governance.
- `detectBudgetSplitKeywords` now excludes negated/coordinated negation matches.

### 4.2 `extract-campaign-facts.ts`

- `extractConstraints()` now records:
  - `"No separate production line — 100% creator fees"`
  - `"No usage rights line — organic creator bundle only"`

### 4.3 Governance hardening

- **IS-2 gate:** new check `budget_no_unauthorized_split` when brief forbids split but allocations contain non–creator-fees lines.
- **QA manager:** new check `qa_budget_no_split_when_forbidden`.

### 4.4 Parser guard

- `structured-section-builders.buildBudgetSectionData` skips category lines containing negation + production/usage-rights wording.

### 4.5 Validation

- Fixture: `features/campaign-director/fixtures/c16-brief.txt`
- Test: `features/campaign-director/services/budget-rules.test.ts`
- BL-1 script: `c16` fixture added to `scripts/validate-bl1-business-logic.mjs`

### Post-fix C16 result

```
split keywords: (none)
allocations: Creator fees 100%
```

---

## 5. Validation results

| Check | Result |
|-------|--------|
| `budget-rules.test.ts` | PASS |
| `validate-bl1-business-logic.mjs` (7 fixtures incl. C16) | 77/77 PASS |
| `tsc --noEmit` | PASS |
| `npm run build` | PASS |

---

## 6. Recommendations (future — not implemented)

1. OCR pipeline for image PDFs so `rawBriefExcerpt` in CampaignFacts matches uploaded brief text.
2. Add negated-keyword cases to IS-2 and Release 1.1.7 regression suites permanently.
3. Consider failing QA when **any** non–creator-fees line appears unless `detectBudgetSplitKeywords` returns ≥1 affirmative match.

---

## 7. Files changed

- `features/campaign-director/services/budget-rules.ts` — root fix
- `features/campaign-director/facts/extract-campaign-facts.ts` — constraints
- `features/campaign-director/services/decision-intelligence-gate.ts` — gate check
- `features/campaign-governance/campaign-qa-manager.ts` — QA check
- `features/campaign-intelligence/services/structured-section-builders.ts` — parser guard
- `features/campaign-director/index.ts` — export `briefForbidsBudgetSplit`
- `features/campaign-director/services/budget-rules.test.ts` — new
- `features/campaign-director/fixtures/c16-brief.txt` — new
- `scripts/validate-bl1-business-logic.mjs` — C16 fixture
