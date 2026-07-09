# ERS-1 Creator Integrity Report

Generated: 2026-07-04T01:26:25.239Z

## Summary

- Offline pipeline scenarios: 4/4 PASS
- Live DB scenarios: 0/4 PASS (network-dependent)
- Duplicate creator violations: 0 (offline)

## Find travel creators in Egypt (offline pipeline)

- Query: `Find travel creators in Egypt`
- Status: PASS
- Search executions: 1
- Live DB: no

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| normalizeCreators | 5 | 3 | 2 |
| workflowSearchResults | 5 | 3 | 2 |
| rankingInput | 3 | 3 | 0 |
| rankingOutput | 3 | 3 | 0 |
| campaignObjectDiscovery | 3 | 3 | 0 |
| campaignObjectRecommendations | 3 | 3 | 0 |
| uiHydration | 3 | 3 | 0 |

## BabyJoy campaign (offline pipeline)

- Query: `Create BabyJoy baby care campaign in Egypt for new parents`
- Status: PASS
- Search executions: 1
- Live DB: no

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| normalizeCreators | 5 | 3 | 2 |
| workflowSearchResults | 5 | 3 | 2 |
| rankingInput | 3 | 3 | 0 |
| rankingOutput | 3 | 3 | 0 |
| campaignObjectDiscovery | 3 | 3 | 0 |
| campaignObjectRecommendations | 3 | 3 | 0 |
| uiHydration | 3 | 3 | 0 |

## Luxury hotel campaign (offline pipeline)

- Query: `Find luxury hotel creators in Egypt for a 5-star resort campaign`
- Status: PASS
- Search executions: 1
- Live DB: no

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| normalizeCreators | 5 | 3 | 2 |
| workflowSearchResults | 5 | 3 | 2 |
| rankingInput | 3 | 3 | 0 |
| rankingOutput | 3 | 3 | 0 |
| campaignObjectDiscovery | 3 | 3 | 0 |
| campaignObjectRecommendations | 3 | 3 | 0 |
| uiHydration | 3 | 3 | 0 |

## Fashion campaign (offline pipeline)

- Query: `Find fashion creators in UAE for a luxury brand campaign`
- Status: PASS
- Search executions: 1
- Live DB: no

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| normalizeCreators | 5 | 3 | 2 |
| workflowSearchResults | 5 | 3 | 2 |
| rankingInput | 3 | 3 | 0 |
| rankingOutput | 3 | 3 | 0 |
| campaignObjectDiscovery | 3 | 3 | 0 |
| campaignObjectRecommendations | 3 | 3 | 0 |
| uiHydration | 3 | 3 | 0 |

## Find travel creators in Egypt (live DB)

- Query: `Find travel creators in Egypt`
- Status: FAIL
- Search executions: 0
- Live DB: yes

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |

**Violations:**
- [runtime] TypeError: fetch failed

## BabyJoy campaign (live DB)

- Query: `Create BabyJoy baby care campaign in Egypt for new parents`
- Status: FAIL
- Search executions: 0
- Live DB: yes

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |

**Violations:**
- [runtime] TypeError: fetch failed

## Luxury hotel campaign (live DB)

- Query: `Find luxury hotel creators in Egypt for a 5-star resort campaign`
- Status: FAIL
- Search executions: 0
- Live DB: yes

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |

**Violations:**
- [runtime] TypeError: fetch failed

## Fashion campaign (live DB)

- Query: `Find fashion creators in UAE for a luxury brand campaign`
- Status: FAIL
- Search executions: 0
- Live DB: yes

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |

**Violations:**
- [runtime] TypeError: fetch failed

## Root causes addressed

- Single SSOT: `browseUnifiedCreators` with unified_id dedupe at output
- `normalizeCreators` dedupes by creator id at every normalization boundary
- Workflow `searchResults` stored deduped; duplicate searchCreators tool output ignored
- Ranking/build-shortlist consumes `searchResults` only — no second search
- CampaignObject discovery/recommendation creatorIds deduped
- UI hydration and vendor cards dedupe before render
- Removed fabricated placeholder vendor fallback (`Creator N` / `@creator-N`)
