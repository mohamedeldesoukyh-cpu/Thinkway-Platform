# ERS-1 Live Discovery Parity Report

Generated: 2026-07-04T01:26:28.627Z

## Summary

- Scenarios: 4
- Passed: 4/4
- Live DB: yes
- TLS bypass: NODE_TLS_REJECT_UNAUTHORIZED=0 (Windows corporate SSL)

## Connectivity

- Category: tls_certificate
- Node: v24.16.0
- dns.lookup: OK (13ms)
- dns.lookup.ipv6: FAIL (3ms)
- tls.handshake: FAIL (136ms)
- fetch.origin: OK (192ms)
- fetch.rest: OK (354ms)

## Definition of Done

| Check | Status |
| --- | --- |
| Live DB passes | PASS |
| One browseUnifiedCreators only | PASS |
| One searchCreators only | PASS |
| One ranking only | PASS |
| Zero duplicate IDs | PASS |
| Discovery == Campaign Studio | PASS |
| Recommendations <= Discovery | PASS |

## Remaining integrity issues

### TLS / network

- Node TLS handshake fails against Supabase hostname (corporate SSL inspection).
- Live validation required `NODE_TLS_REJECT_UNAUTHORIZED=0`; REST fetch still succeeds.
- Recommended fix: `NODE_OPTIONS=--use-system-ca` or install org root CA.

### UI verification

- Puppeteer UI run: see `live-parity-ui.json` (requires dev server at localhost:3000).
- Run: `node scripts/ers-1-live-parity.mjs` after `npm run dev`.

## Find travel creators in Egypt

- Query: `Find travel creators in Egypt`
- Status: PASS
- browseUnifiedCreators: 1
- searchCreators: 1
- ranking: 1
- Discovery count: 31
- Recommendation count: 10
- Campaign Studio count: 31

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| scoutGroundedSearch | 31 | 31 | 0 |
| browseUnifiedCreators | 1 | 1 | 0 |
| searchCreatorsTool | 1 | 1 | 0 |
| workflowSearchResults | 31 | 31 | 0 |
| rankingInput | 31 | 31 | 0 |
| rankingOutput | 31 | 31 | 0 |
| campaignObjectDiscovery | 31 | 31 | 0 |
| campaignObjectRecommendations | 31 | 10 | 21 |
| uiHydration | 10 | 8 | 2 |

## Find luxury hotel creators in Dubai

- Query: `Find luxury hotel creators in Dubai for a 5-star resort campaign`
- Status: PASS
- browseUnifiedCreators: 1
- searchCreators: 1
- ranking: 1
- Discovery count: 50
- Recommendation count: 10
- Campaign Studio count: 50

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| scoutGroundedSearch | 50 | 50 | 0 |
| browseUnifiedCreators | 1 | 1 | 0 |
| searchCreatorsTool | 1 | 1 | 0 |
| workflowSearchResults | 50 | 50 | 0 |
| rankingInput | 50 | 50 | 0 |
| rankingOutput | 50 | 50 | 0 |
| campaignObjectDiscovery | 50 | 50 | 0 |
| campaignObjectRecommendations | 50 | 10 | 40 |
| uiHydration | 10 | 8 | 2 |

## BabyJoy campaign

- Query: `Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.`
- Status: PASS
- browseUnifiedCreators: 1
- searchCreators: 1
- ranking: 1
- Discovery count: 39
- Recommendation count: 10
- Campaign Studio count: 39

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| scoutGroundedSearch | 39 | 39 | 0 |
| browseUnifiedCreators | 1 | 1 | 0 |
| searchCreatorsTool | 1 | 1 | 0 |
| workflowSearchResults | 39 | 39 | 0 |
| rankingInput | 39 | 39 | 0 |
| rankingOutput | 39 | 39 | 0 |
| campaignObjectDiscovery | 39 | 39 | 0 |
| campaignObjectRecommendations | 39 | 10 | 29 |
| uiHydration | 10 | 8 | 2 |

## Adidas campaign

- Query: `Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks. Objective: Product launch and conversion.`
- Status: PASS
- browseUnifiedCreators: 1
- searchCreators: 1
- ranking: 1
- Discovery count: 50
- Recommendation count: 10
- Campaign Studio count: 50

| Stage | Before | After | Duplicates removed |
| --- | ---: | ---: | ---: |
| scoutGroundedSearch | 50 | 50 | 0 |
| browseUnifiedCreators | 1 | 1 | 0 |
| searchCreatorsTool | 1 | 1 | 0 |
| workflowSearchResults | 50 | 50 | 0 |
| rankingInput | 50 | 50 | 0 |
| rankingOutput | 50 | 50 | 0 |
| campaignObjectDiscovery | 50 | 50 | 0 |
| campaignObjectRecommendations | 50 | 10 | 40 |
| uiHydration | 10 | 8 | 2 |
