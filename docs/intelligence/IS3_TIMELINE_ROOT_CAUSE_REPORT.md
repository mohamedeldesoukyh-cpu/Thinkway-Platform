# IS-3 Timeline Validation Root Cause Report

**Generated:** 2026-07-05  
**Sprint:** IS-3 Director Decision Debate Engine  
**Audit:** Subagent `125845f0` (read-only investigation)  
**Status:** Root cause confirmed — fix not implemented

---

## Executive summary

The IS-3 material-difference validator fails with **"Option A should have aggressive (shorter) timeline vs balanced"** when a campaign's balanced duration (`baseDuration`) is **≤ 4 weeks**. The failure occurs at **option generation time**, before leadership debate runs.

**Root cause:** Option A's compressed timeline is hard-floored at 4 weeks via `Math.max(4, baseDuration - 2)` in `option-generator.ts`. When `baseDuration ≤ 4`, Option A's `durationWeeks` is **≥ Option B's**, which violates the assertion in `validateOptionMaterialDifference`. This is **not** caused by later normalization in timeline builders, facts display bridge, or `apply-winner`.

---

## Root cause (single statement)

**The 4-week minimum on Option A's compressed timeline (`Math.max(4, baseDuration - 2)`) prevents Option A from ever being shorter than Option B when the campaign's balanced duration is ≤ 4 weeks, causing material-difference validation to fail immediately after generation.**

---

## Reproduction matrix

| `baseDuration` | Option A | Option B | Option C | Validation |
|----------------|----------|----------|----------|------------|
| 3 | 4 | 3 | 5 | **FAIL** — A > B (semantically inverted) |
| 4 | 4 | 4 | 6 | **FAIL** — A = B |
| 5 | 4 | 5 | 7 | PASS |
| 6 (BabyJoy fixture) | 4 | 6 | 8 | PASS |
| 8 (Coca-Cola fixture) | 6 | 8 | 10 | PASS |

Reproduce with:

```bash
npx tsx scripts/validate-is3-debate-engine.mjs
```

Standard fixtures pass (30/30). A 4-week brief (e.g. `"Quick 4 week brand push for Nike budget USD 100000"`) fails before debate.

> **Note:** Run validation with **`npx tsx`**, not bare `node`. Bare `node` fails on TypeScript path aliases (`@/lib`, etc.) before reaching debate logic. The script header comment still says `node`; use `npx tsx` in practice.

---

## Timeline values at three checkpoints

Validation runs **immediately after** `generateCampaignOptions` and **before** `runLeadershipDebate`. Leadership debate is read-only — it does not mutate option timelines. Therefore checkpoints **after generation** and **before validation** are identical. For PASS cases, **after debate** is also unchanged (options array is never rewritten).

### BabyJoy (`baseDuration = 6`) — PASS

Brief: *"Launch BabyJoy Premium Diapers in Egypt… Campaign duration 6 weeks."*

| Option | After generation | After debate | Before validation |
|--------|------------------|--------------|-------------------|
| **A** (Max Reach) | **4w** · Macro 70% / Micro 20% / Nano 10% | Same | Same |
| **B** (Balanced) | **6w** · Macro 35% / Micro 40% / Nano 25% | Same | Same |
| **C** (Max Engagement) | **8w** · Macro 15% / Micro 45% / Nano 40% | Same | Same |

Ordering: A (4) < B (6) < C (8) — validation passes. Confirmed in `docs/intelligence/is3-debate-engine-validation-results.json` (fixture `babyjoy`).

### Coca-Cola (`baseDuration = 8`) — PASS

Brief: *"Strategize a Coca-Cola summer engagement campaign… for 8 weeks."*

| Option | After generation | After debate | Before validation |
|--------|------------------|--------------|-------------------|
| **A** (Max Reach) | **6w** · Macro 70% / Micro 20% / Nano 10% | Same | Same |
| **B** (Balanced) | **8w** · Macro 35% / Micro 40% / Nano 25% | Same | Same |
| **C** (Max Engagement) | **10w** · Macro 15% / Micro 45% / Nano 40% | Same | Same |

Ordering: A (6) < B (8) < C (10) — validation passes. Confirmed in `docs/intelligence/is3-debate-engine-validation-results.json` (fixture `cocacola`).

### Failing case (`baseDuration = 4`) — FAIL

Example brief: *"Quick 4 week brand push for Nike budget USD 100000"*

| Option | After generation | After debate | Before validation |
|--------|------------------|--------------|-------------------|
| **A** (Max Reach) | **4w** (floor blocks 2w compression) | **N/A** — pipeline aborts | **4w** (same as generation) |
| **B** (Balanced) | **4w** | **N/A** | **4w** |
| **C** (Max Engagement) | **6w** | **N/A** | **6w** |

A and B are **identical at generation** (`4w = 4w`). `validateOptionMaterialDifference` throws before `runLeadershipDebate` is invoked — debate never runs.

Error emitted:

```
IS-3 material difference validation failed: Option A should have aggressive (shorter) timeline vs balanced
```

When `baseDuration = 3`, A=4 and B=3 — Option A is **longer** than balanced (inverted semantics), triggering the same assertion.

---

## Flow trace

```
Brief → extractCampaignFacts → validateCampaignFacts
  → writeStrategyDocumentFromBrief (sets understanding.timeline.durationWeeks)
  → runDirectorDebateEngine
       ├─ generateCampaignOptions          ← A/B/C timelines assigned (BUG HERE)
       ├─ validateOptionMaterialDifference ← FAILS when baseDuration ≤ 4
       ├─ runLeadershipDebate              ← never reached on failure
       ├─ aggregateDebateScores
       └─ runDirectorMeeting
  → applyWinnerOptionToStrategy           ← winner timeline → strategy only
  → dispatchSpecialists / challenge loop
  → buildClientTimelineFromStrategy       ← single winner duration
  → buildIs1ReasoningBundle / section builders
```

### 1. `option-generator.ts` — timeline assignment

`baseDuration` resolves from strategy SSOT, then facts, then default 6:

```111:111:features/campaign-director/debate/option-generator.ts
  const baseDuration = strategy.understanding.timeline?.durationWeeks ?? facts.durationWeeks ?? 6;
```

Per-option formulas:

| Option | Archetype | Formula | Lines |
|--------|-----------|---------|-------|
| **A** | `max_reach` | `Math.max(4, baseDuration - 2)` | 119–125 |
| **B** | `balanced` | `baseDuration` | 145–148 |
| **C** | `max_engagement` | `baseDuration + 2` | 165–168 |

The **4-week floor on Option A** (lines 122, 119) is the defect. Platform minimum campaign duration is 1 week (`MIN_CAMPAIGN_DURATION_WEEKS` in `timeline-duration.ts`), so the generator floor is stricter and independent of facts validation.

### 2. `debate-engine.ts` — validation timing and assertion

Orchestration order:

```91:98:features/campaign-director/debate/debate-engine.ts
  const options = generateCampaignOptions(facts, strategy);
  const materialValidation = validateOptionMaterialDifference(options);

  if (!materialValidation.valid) {
    throw new Error(
      `IS-3 material difference validation failed: ${materialValidation.errors.join("; ")}`
    );
  }
```

Failing assertion — compares numeric `timeline.durationWeeks`, gated on `archetype === "max_reach"`:

```58:60:features/campaign-director/debate/debate-engine.ts
  if (a.timeline.durationWeeks >= b.timeline.durationWeeks && a.archetype === "max_reach") {
    errors.push("Option A should have aggressive (shorter) timeline vs balanced");
  }
```

Related checks (same function):

- Line 53–56: at least 2 distinct durations across all options
- Line 62–64: Option C must be extended vs balanced

Options are destructured positionally as `[a, b, c] = options` (indices 0/1/2 = A/B/C as returned by the generator). Field compared is correct; the bug is in generated values, not comparison logic.

### 3. `leadership-debate.ts` — read-only reviews

Seven directors review all three options. Timeline values appear only in review prose (e.g. Media Director lines 110, 122, 133). **No mutation** of `CampaignOption` objects.

### 4. `apply-winner.ts` — winner propagates to strategy only

After debate completes, only the winning option's timeline is copied onto the strategy document:

```20:23:features/campaign-director/debate/apply-winner.ts
      timeline: {
        durationWeeks: winner.timeline.durationWeeks,
        rationale: winner.timeline.rationale,
      },
```

`debateResult.options[]` retain their original A/B/C timelines unchanged.

### 5. Downstream timeline builders — post-debate, single duration

These modules consume the **winner-adjusted** strategy duration. They do not read or rewrite per-option debate timelines.

| Module | Function | Role | Mutates A/B/C options? |
|--------|----------|------|------------------------|
| `timeline-rules.ts` | `buildClientTimelineFromStrategy` | Client-facing week-by-week phases from `strategy.understanding.timeline.durationWeeks` | No |
| `section-builder-integration.ts` | `applyDirectorTimelineRules` | Maps client timeline into section data | No |
| `facts-display-bridge.ts` | `buildTimelineSectionDataFromFacts` | Clamps duration via `clampCampaignDurationWeeks` for display | No |
| `timeline-duration.ts` | `resolveCampaignDurationWeeks` | Facts/text duration resolution for studio UI | No — not in debate path |
| `creator-activation-timeline.ts` | `buildCreatorActivationTimeline` | IS-1 week plan from `ctx.durationWeeks` (winner context) | No |
| `campaign-director.ts` | `runCampaignDirectorPipeline` | Calls debate → apply winner → `buildClientTimelineFromStrategy` at line 94 | No |

Pipeline integration point:

```68:69:features/campaign-director/services/campaign-director.ts
  const debateResult = runDirectorDebateEngine(campaignFacts, baseStrategyDocument);
  const strategyDocument = applyWinnerOptionToStrategy(baseStrategyDocument, debateResult);
```

---

## Evidence table

| Location | Lines | What |
|----------|-------|------|
| `features/campaign-director/debate/option-generator.ts` | 111 | `baseDuration` resolution |
| `features/campaign-director/debate/option-generator.ts` | 119, 122 | Option A `Math.max(4, baseDuration - 2)` in slice text and `durationWeeks` |
| `features/campaign-director/debate/option-generator.ts` | 146 | Option B `durationWeeks: baseDuration` |
| `features/campaign-director/debate/option-generator.ts` | 166 | Option C `durationWeeks: baseDuration + 2` |
| `features/campaign-director/debate/debate-engine.ts` | 53–56 | Distinct-duration set check |
| `features/campaign-director/debate/debate-engine.ts` | 58–59 | **Failing A ≥ B assertion** |
| `features/campaign-director/debate/debate-engine.ts` | 62–64 | C extended vs B check |
| `features/campaign-director/debate/debate-engine.ts` | 91–97 | Validation before debate; throw on failure |
| `features/campaign-director/debate/leadership-debate.ts` | 110, 122, 133 | Read-only `option.timeline.durationWeeks` in reviews |
| `features/campaign-director/debate/apply-winner.ts` | 20–22 | Winner timeline → strategy |
| `features/campaign-studio/services/timeline-duration.ts` | 3–4, 10–13 | `MIN_CAMPAIGN_DURATION_WEEKS = 1` (generator floor of 4 is stricter) |
| `features/campaign-director/services/timeline-rules.ts` | 100–108 | Post-debate client timeline from strategy duration |
| `scripts/validate-is3-debate-engine.mjs` | 114–118 | Indirect check via `runDirectorDebateEngine` |

---

## Answers to investigation questions

| Question | Answer |
|----------|--------|
| Are A/B/C timelines distinct at generation? | **Yes** when `baseDuration ≥ 5`; **no** for A vs B when `baseDuration ≤ 4` |
| Normalized or overwritten later? | **No** — failure occurs pre-debate; downstream code uses winner only |
| Wrong field compared in validation? | **No** — compares `timeline.durationWeeks` numbers on archetype-gated Option A |
| Identical at any stage? | **A = B when `baseDuration ≤ 4`** at generation; never mutated afterward |
| Does leadership debate fix it? | **No** — debate never runs on failure; even on success, options are read-only |
| Why do BabyJoy/Coca-Cola pass? | Durations 6w and 8w yield A=4/6 and B=6/8 — strict ordering holds |

---

## Recommended fix direction (do not implement)

1. **Remove or lower the hard floor in Option A.** Replace `Math.max(4, baseDuration - 2)` with `Math.max(MIN_CAMPAIGN_DURATION_WEEKS, baseDuration - 2)` where `MIN_CAMPAIGN_DURATION_WEEKS = 1` (`timeline-duration.ts`).

2. **Guarantee strict ordering at generation.** Enforce `A.durationWeeks < B.durationWeeks < C.durationWeeks` explicitly, e.g.:
   - A = `max(1, baseDuration - 2)`
   - B = `baseDuration`
   - C = `baseDuration + 2`
   - For `baseDuration < 3`, either shift all three upward or reject sub-3-week campaigns with a clear pipeline error.

3. **Optional defensive hardening.** Resolve options by `id` (`"A"`, `"B"`, `"C"`) in `validateOptionMaterialDifference` instead of positional array index — not the current bug, but reduces fragility.

4. **Validator regression coverage.** Update `scripts/validate-is3-debate-engine.mjs` header to document `npx tsx`; add a ≤4-week fixture (e.g. 4-week Nike brief) so the floor bug cannot regress silently.

5. **Do not relax validation.** The assertion correctly encodes product intent (reach-first = shorter). Fix generation, not the validator.

---

## Related artifacts

- `docs/intelligence/is3-debate-engine-validation-results.json` — BabyJoy/Coca-Cola PASS evidence
- `docs/intelligence/IS3_DEBATE_ENGINE_REPORT.md` — full IS-3 validation report
- Audit transcript: subagent `125845f0-1b9c-48ab-ae77-ef7c100aaabc`

---

*Investigation only — no code changes applied.*
