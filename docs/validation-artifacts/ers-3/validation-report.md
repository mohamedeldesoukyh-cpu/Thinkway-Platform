# ERS-3 Campaign Object Integrity Report

Generated: 2026-07-04T01:26:20.894Z

## Summary

- Render path violations: 0
- Scenarios passed: 5/5
- Validation script: PASS

## Render path checks

- No stripMarkdown, JSON.parse, or cross-section .content reads in resolver/renderers

## Scenario results

| Scenario | Status | Studio sections | Structured paths |
| --- | --- | ---: | --- |
| BabyJoy | PASS | 16/16 | 10 |
| Adidas | PASS | 16/16 | 10 |
| Rolex | PASS | 16/16 | 10 |
| Tourism | PASS | 16/16 | 10 |
| Finance | PASS | 16/16 | 10 |



## Files changed (ERS-3)

- `features/campaign-intelligence/types/section-schemas.ts` — extended structured schemas + STUDIO_SECTION_OWNERS
- `features/campaign-intelligence/services/studio-section-data-builders.ts` — write-time structured data assembly
- `features/campaign-intelligence/services/section-updaters.ts` — enrich after task/summary sync
- `features/campaign-studio/services/section-data-resolver.ts` — structured-only render path
- `features/campaign-studio/components/sections/*.tsx` — removed markdown parsing fallbacks
- `features/campaign-intelligence/services/studio-renderer.ts` — pass campaignObject in studio state
