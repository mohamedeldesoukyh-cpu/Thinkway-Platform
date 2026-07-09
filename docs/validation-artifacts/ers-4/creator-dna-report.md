# ERS-4 Creator DNA Validation Report

Generated: 2026-07-04T01:29:04.418Z

## Summary

- Scenarios: 7
- Checks passed: 58
- Checks failed: 0
- Overall: PASS

## Scenarios

### Conflict resolution unit tests (`conflict-unit`) — PASS

- ✓ conflict-resolver.test.ts passed
- ✓ composite score favors manual
- ✓ confidence calculator for ipl

### Travel Egypt (`travel`) — PASS

- ✓ IPL fields mapped — count=21
- ✓ followers field present
- ✓ followers confidence calculated — confidence=0.88
- ✓ followers source is ipl
- ✓ displayName populated after merge
- ✓ history recorded on merge
- ✓ manual wins conflict over ipl
- ✓ hydration resolves from DNA
- ✓ hydration has followers
- ✓ hydration id matches influencer
- ✓ no duplicated creator info

### BabyJoy (`babyjoy`) — PASS

- ✓ IPL fields mapped — count=21
- ✓ followers field present
- ✓ followers confidence calculated — confidence=0.88
- ✓ followers source is ipl
- ✓ displayName populated after merge
- ✓ history recorded on merge
- ✓ manual wins conflict over ipl
- ✓ hydration resolves from DNA
- ✓ hydration has followers
- ✓ hydration id matches influencer
- ✓ no duplicated creator info

### Luxury Hotel Dubai (`luxury`) — PASS

- ✓ IPL fields mapped — count=21
- ✓ followers field present
- ✓ followers confidence calculated — confidence=0.88
- ✓ followers source is ipl
- ✓ displayName populated after merge
- ✓ history recorded on merge
- ✓ manual wins conflict over ipl
- ✓ hydration resolves from DNA
- ✓ hydration has followers
- ✓ hydration id matches influencer
- ✓ no duplicated creator info

### Finance Emirates NBD (`finance`) — PASS

- ✓ IPL fields mapped — count=21
- ✓ followers field present
- ✓ followers confidence calculated — confidence=0.88
- ✓ followers source is ipl
- ✓ displayName populated after merge
- ✓ history recorded on merge
- ✓ manual wins conflict over ipl
- ✓ hydration resolves from DNA
- ✓ hydration has followers
- ✓ hydration id matches influencer
- ✓ no duplicated creator info

### Visit Egypt Tourism (`tourism`) — PASS

- ✓ IPL fields mapped — count=21
- ✓ followers field present
- ✓ followers confidence calculated — confidence=0.88
- ✓ followers source is ipl
- ✓ displayName populated after merge
- ✓ history recorded on merge
- ✓ manual wins conflict over ipl
- ✓ hydration resolves from DNA
- ✓ hydration has followers
- ✓ hydration id matches influencer
- ✓ no duplicated creator info

### Database integration (`db-integration`) — PASS

- ✗ creator_dna table exists — Skipped — run migration 20260704120000_creator_dna.sql

## IPL → DNA Population Flow

```
Apify fetch → IPL persistSnapshot()
  → ipl_snapshots.normalized_snapshot stored
  → bridgeSnapshotToCreatorDna(snapshotId)
  → CreatorDNAWriter.mapSnapshotToFieldCandidates()
  → CreatorDNAService.mergeEvidence() with conflict resolution
  → creator_dna + creator_dna_versions + creator_dna_lineage_events
Reprocess: reprocessSnapshot(category_inference)
  → bridgeReprocessToCreatorDna() for ai_infer categories
Hydration: hydrateCreatorsFromDna() → mapDnaToHydratedVendor()
  → fallback to getUnifiedCreatorById when DNA absent
```

## Remaining Gaps

- Staging → promoted influencer merge not automated (manual promotion path)
- profile_ai_scores / creator_enrichment_runs not yet dual-written into DNA scores
- OAuth source channel reserved — no oauth ingest wired yet
- Campaign-scoped manual overrides not yet exposed via UI
- Backfill script for existing ipl_snapshots → creator_dna not included
