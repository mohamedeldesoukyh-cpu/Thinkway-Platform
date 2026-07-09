# IS-3 Director Decision Debate Engine Report

Generated: 2026-07-04T23:11:42.129Z

## Summary

**Manual QA pending — do not claim PASS.**

- Automated checks: 90/90
- Directors per debate: 7
- Reviews per fixture: 21 (7 × 3 options)

automated checks: 90/90; manual QA pending — do not claim PASS

## Debate Flow

```
Brief → CampaignFacts → Director Strategy
 → Generate 3 complete strategy options (A Max Reach, B Balanced, C Max Engagement)
 → All options share facts durationWeeks — differ by tier mix, activation, KPIs
 → Agency Leadership Debate (7 directors review ALL 3, no editing)
 → Scoring 0-100 per director per option with explanation
 → Campaign Director meeting → winner selected
 → CampaignObject (winner only)
```

## Files Changed

| Module | File | Capability |
|--------|------|------------|
| Debate Types | `features/campaign-director/debate/debate-types.ts` | CampaignOption + activationPlan |
| Activation Plan | `features/campaign-director/debate/activation-plan.ts` | Week weights (burst/even/ramp) |
| Option Generator | `features/campaign-director/debate/option-generator.ts` | 3 strategy-different options |
| Material Validator | `features/campaign-director/debate/material-difference-validator.ts` | ≥4 dimension check |
| Leadership Debate | `features/campaign-director/debate/leadership-debate.ts` | 7 directors × 3 options |
| Debate Scorer | `features/campaign-director/debate/debate-scorer.ts` | Weighted winner selection |
| Director Meeting | `features/campaign-director/debate/director-meeting.ts` | Winner + rejection reasons |
| Debate Engine | `features/campaign-director/debate/debate-engine.ts` | Orchestrator + material validation |
| Apply Winner | `features/campaign-director/debate/apply-winner.ts` | Winner → strategy + metadata |
| Pipeline | `features/campaign-director/services/campaign-director.ts` | Debate after strategy, before specialists |
| Reasoning | `features/campaign-intelligence/services/reasoning/*.ts` | Debate context in IS-1/IS-2 builders |

## Per-Fixture Results

### BabyJoy

#### Options Generated

- **Option A (Maximum Reach)**: Macro 70% · Micro 20% · Nano 10%, 4 weeks, burst [70/10/10/10]
- **Option B (Balanced)**: Macro 35% · Micro 40% · Nano 25%, 4 weeks, even [25/25/25/25]
- **Option C (Maximum Engagement)**: Macro 15% · Micro 45% · Nano 40%, 4 weeks, ramp [15/20/35/30]

**Material dimensions:** creatorTierAllocation, postingCadence, objectiveEmphasis, kpiPriorities, budgetAllocation, riskProfile, audienceStrategy, creatorMix, activationApproach

#### Scores

| Option | Weighted Score | Approvals |
|--------|----------------|-----------|
| A | 55.2 | 0/7 |
| B | 75.6 | 7/7 |
| C | 86.7 | 7/7 |

**Winner:** Option C (Maximum Engagement)

#### Rejected Strategies

- **Option A**: Weighted score 55.2/100 with 0/7 director approvals — below winning threshold.
- **Option B**: Weighted score 75.6/100 with 7/7 director approvals — below winning threshold.

#### Debate Summary

Campaign Director approves Option C (Maximum Engagement) — weighted score 86.7/100, 7/7 director approvals. BabyJoy — Maximum Engagement: heavy Micro/Nano UGC-first mix, ramp activation (W1 15%, W2 20...

#### Validation Checks

| Check | Result |
|-------|--------|
| 3 options generated | OK |
| All options share facts durationWeeks | OK |
| ≥4 material dimension differences | OK |
| Material difference validated | OK |
| Creator mix differs substantively (A Macro vs C Nano) | OK |
| Activation approaches differ (burst/even/ramp) | OK |
| 7 directors × 3 options reviews | OK |
| All reviews have scores 0-100 | OK |
| Winner selected | OK |
| Rejection reasons for losers | OK |
| Pipeline includes debateResult | OK |
| Pipeline debate matches standalone | OK |
| Strategy reflects winner option tiers | OK |
| Executive strategy references debate winner | OK |
| Director minutes include debate summary | OK |
| Rejected options NOT in section content | OK |
| Debate metadata stored in meta.directorDebate | OK |
| Debate metadata in meta.directorPipeline.debateResult | OK |

### Coca-Cola

#### Options Generated

- **Option A (Maximum Reach)**: Macro 70% · Micro 20% · Nano 10%, 6 weeks, burst [70/6/6/6/6/6]
- **Option B (Balanced)**: Macro 35% · Micro 40% · Nano 25%, 6 weeks, even [16/16/16/16/16/20]
- **Option C (Maximum Engagement)**: Macro 15% · Micro 45% · Nano 40%, 6 weeks, ramp [10/15/18/22/20/15]

**Material dimensions:** creatorTierAllocation, postingCadence, objectiveEmphasis, kpiPriorities, budgetAllocation, riskProfile, audienceStrategy, creatorMix, activationApproach

#### Scores

| Option | Weighted Score | Approvals |
|--------|----------------|-----------|
| A | 55.2 | 0/7 |
| B | 75.6 | 7/7 |
| C | 86.7 | 7/7 |

**Winner:** Option C (Maximum Engagement)

#### Rejected Strategies

- **Option A**: Weighted score 55.2/100 with 0/7 director approvals — below winning threshold.
- **Option B**: Weighted score 75.6/100 with 7/7 director approvals — below winning threshold.

#### Debate Summary

Campaign Director approves Option C (Maximum Engagement) — weighted score 86.7/100, 7/7 director approvals. Coca-Cola — Maximum Engagement: heavy Micro/Nano UGC-first mix, ramp activation (W1 10%, W2 ...

#### Validation Checks

| Check | Result |
|-------|--------|
| 3 options generated | OK |
| All options share facts durationWeeks | OK |
| ≥4 material dimension differences | OK |
| Material difference validated | OK |
| Creator mix differs substantively (A Macro vs C Nano) | OK |
| Activation approaches differ (burst/even/ramp) | OK |
| 7 directors × 3 options reviews | OK |
| All reviews have scores 0-100 | OK |
| Winner selected | OK |
| Rejection reasons for losers | OK |
| Pipeline includes debateResult | OK |
| Pipeline debate matches standalone | OK |
| Strategy reflects winner option tiers | OK |
| Executive strategy references debate winner | OK |
| Director minutes include debate summary | OK |
| Rejected options NOT in section content | OK |
| Debate metadata stored in meta.directorDebate | OK |
| Debate metadata in meta.directorPipeline.debateResult | OK |

### Tourism Egypt

#### Options Generated

- **Option A (Maximum Reach)**: Macro 70% · Micro 20% · Nano 10%, 8 weeks, burst [70/4/4/4/4/4/4/6]
- **Option B (Balanced)**: Macro 35% · Micro 40% · Nano 25%, 8 weeks, even [12/12/12/12/12/12/12/16]
- **Option C (Maximum Engagement)**: Macro 15% · Micro 45% · Nano 40%, 8 weeks, ramp [8/10/14/18/20/16/10/4]

**Material dimensions:** creatorTierAllocation, postingCadence, objectiveEmphasis, kpiPriorities, budgetAllocation, riskProfile, audienceStrategy, creatorMix, activationApproach

#### Scores

| Option | Weighted Score | Approvals |
|--------|----------------|-----------|
| A | 55.2 | 0/7 |
| B | 75.6 | 7/7 |
| C | 86.7 | 7/7 |

**Winner:** Option C (Maximum Engagement)

#### Rejected Strategies

- **Option A**: Weighted score 55.2/100 with 0/7 director approvals — below winning threshold.
- **Option B**: Weighted score 75.6/100 with 7/7 director approvals — below winning threshold.

#### Debate Summary

Campaign Director approves Option C (Maximum Engagement) — weighted score 86.7/100, 7/7 director approvals. Tourism Egypt — Maximum Engagement: heavy Micro/Nano UGC-first mix, ramp activation (W1 8%, ...

#### Validation Checks

| Check | Result |
|-------|--------|
| 3 options generated | OK |
| All options share facts durationWeeks | OK |
| ≥4 material dimension differences | OK |
| Material difference validated | OK |
| Creator mix differs substantively (A Macro vs C Nano) | OK |
| Activation approaches differ (burst/even/ramp) | OK |
| 7 directors × 3 options reviews | OK |
| All reviews have scores 0-100 | OK |
| Winner selected | OK |
| Rejection reasons for losers | OK |
| Pipeline includes debateResult | OK |
| Pipeline debate matches standalone | OK |
| Strategy reflects winner option tiers | OK |
| Executive strategy references debate winner | OK |
| Director minutes include debate summary | OK |
| Rejected options NOT in section content | OK |
| Debate metadata stored in meta.directorDebate | OK |
| Debate metadata in meta.directorPipeline.debateResult | OK |

### Samsung

#### Options Generated

- **Option A (Maximum Reach)**: Macro 70% · Micro 20% · Nano 10%, 6 weeks, burst [70/6/6/6/6/6]
- **Option B (Balanced)**: Macro 35% · Micro 40% · Nano 25%, 6 weeks, even [16/16/16/16/16/20]
- **Option C (Maximum Engagement)**: Macro 15% · Micro 45% · Nano 40%, 6 weeks, ramp [10/15/18/22/20/15]

**Material dimensions:** creatorTierAllocation, postingCadence, objectiveEmphasis, kpiPriorities, budgetAllocation, riskProfile, audienceStrategy, creatorMix, activationApproach

#### Scores

| Option | Weighted Score | Approvals |
|--------|----------------|-----------|
| A | 55.2 | 0/7 |
| B | 75.6 | 7/7 |
| C | 86.7 | 7/7 |

**Winner:** Option C (Maximum Engagement)

#### Rejected Strategies

- **Option A**: Weighted score 55.2/100 with 0/7 director approvals — below winning threshold.
- **Option B**: Weighted score 75.6/100 with 7/7 director approvals — below winning threshold.

#### Debate Summary

Campaign Director approves Option C (Maximum Engagement) — weighted score 86.7/100, 7/7 director approvals. Samsung — Maximum Engagement: heavy Micro/Nano UGC-first mix, ramp activation (W1 10%, W2 15...

#### Validation Checks

| Check | Result |
|-------|--------|
| 3 options generated | OK |
| All options share facts durationWeeks | OK |
| ≥4 material dimension differences | OK |
| Material difference validated | OK |
| Creator mix differs substantively (A Macro vs C Nano) | OK |
| Activation approaches differ (burst/even/ramp) | OK |
| 7 directors × 3 options reviews | OK |
| All reviews have scores 0-100 | OK |
| Winner selected | OK |
| Rejection reasons for losers | OK |
| Pipeline includes debateResult | OK |
| Pipeline debate matches standalone | OK |
| Strategy reflects winner option tiers | OK |
| Executive strategy references debate winner | OK |
| Director minutes include debate summary | OK |
| Rejected options NOT in section content | OK |
| Debate metadata stored in meta.directorDebate | OK |
| Debate metadata in meta.directorPipeline.debateResult | OK |

### L'Oréal

#### Options Generated

- **Option A (Maximum Reach)**: Macro 70% · Micro 20% · Nano 10%, 5 weeks, burst [70/7/7/7/9]
- **Option B (Balanced)**: Macro 35% · Micro 40% · Nano 25%, 5 weeks, even [20/20/20/20/20]
- **Option C (Maximum Engagement)**: Macro 15% · Micro 45% · Nano 40%, 5 weeks, ramp [12/18/22/28/20]

**Material dimensions:** creatorTierAllocation, postingCadence, objectiveEmphasis, kpiPriorities, budgetAllocation, riskProfile, audienceStrategy, creatorMix, activationApproach

#### Scores

| Option | Weighted Score | Approvals |
|--------|----------------|-----------|
| A | 55.2 | 0/7 |
| B | 75.6 | 7/7 |
| C | 86.7 | 7/7 |

**Winner:** Option C (Maximum Engagement)

#### Rejected Strategies

- **Option A**: Weighted score 55.2/100 with 0/7 director approvals — below winning threshold.
- **Option B**: Weighted score 75.6/100 with 7/7 director approvals — below winning threshold.

#### Debate Summary

Campaign Director approves Option C (Maximum Engagement) — weighted score 86.7/100, 7/7 director approvals. L'Oréal — Maximum Engagement: heavy Micro/Nano UGC-first mix, ramp activation (W1 12%, W2 18...

#### Validation Checks

| Check | Result |
|-------|--------|
| 3 options generated | OK |
| All options share facts durationWeeks | OK |
| ≥4 material dimension differences | OK |
| Material difference validated | OK |
| Creator mix differs substantively (A Macro vs C Nano) | OK |
| Activation approaches differ (burst/even/ramp) | OK |
| 7 directors × 3 options reviews | OK |
| All reviews have scores 0-100 | OK |
| Winner selected | OK |
| Rejection reasons for losers | OK |
| Pipeline includes debateResult | OK |
| Pipeline debate matches standalone | OK |
| Strategy reflects winner option tiers | OK |
| Executive strategy references debate winner | OK |
| Director minutes include debate summary | OK |
| Rejected options NOT in section content | OK |
| Debate metadata stored in meta.directorDebate | OK |
| Debate metadata in meta.directorPipeline.debateResult | OK |

## Validation Checklist

- [x] 3 options generated with material strategy differences
- [x] All options share CampaignFacts durationWeeks
- [x] ≥4 material dimensions differ across options
- [x] 7 directors × 3 options reviews with scores
- [x] Winner selected with rejection reasons for losers
- [x] CampaignObject sections reflect winner only
- [x] Debate metadata stored in meta.directorDebate
- [ ] Manual QA: verify debate not exposed in client UI
- [ ] Manual QA: end-to-end workflow with task results

---

*automated checks: 90/90; manual QA pending — do not claim PASS*
