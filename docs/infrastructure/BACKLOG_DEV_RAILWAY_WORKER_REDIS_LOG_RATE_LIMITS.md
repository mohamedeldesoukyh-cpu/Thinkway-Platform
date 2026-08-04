# Backlog — Development Railway discovery-worker crash (Redis / log rate limits)

**Status:** Open  
**Priority:** P2 (Dev ops reliability)  
**Created:** 2026-08-04  
**Owner:** Platform / DevOps  
**Classification:** **Development infrastructure only** — **not** a product defect  

**Independent of:** Apify Manual Refresh product stabilization (Enterprise Ready on `develop`).  
**Do not** treat this item as a reason to redesign Refresh UX, status aggregation, or budget gates.

---

## Title

Stabilize Development Railway discovery-worker against Redis/BullMQ churn and Railway log rate limits

---

## Problem

After Apify Refresh tip `7a90b5f0` deployed to Railway service **`Thinkway-Platform`** (Dev Supabase `hsxrewjcbvmbkqdlzjhs`), the Dev worker repeatedly entered **Crashed** while:

- Emitting very high-volume BullMQ / Redis Lua script error stacks
- Hitting Railway’s **500 logs/sec** rate limit (`Messages dropped: …`)

This prevented reliable **queued** UI→worker enrichment soaks on Development Preview. Product validation therefore used the same merge engine via service-role `runCreatorEnrichment` (PASS).

Production worker **`Thinkway-Platform-Production`** was **not** modified and remained Online.

---

## Evidence

| Field | Value |
|---|---|
| Railway project | `zealous-magic` |
| Dev service | `Thinkway-Platform` (Crashed after tip deploy) |
| Prod service | `Thinkway-Platform-Production` (Online — leave alone unless Prod deploy approved) |
| Tip SHA | `7a90b5f0` / follow-ups `e66af79b` · `695f8b47` |
| Report | `docs/architecture/APIFY_REFRESH_STABILIZATION_ENTERPRISE_RELEASE.md` |

---

## Acceptance criteria

- [ ] Dev Railway discovery-worker stays **Online** for ≥24h under normal Discovery queue load
- [ ] Redis connectivity for Dev worker is correct (Upstash Dev / expected host) and stable under BullMQ stall checks
- [ ] Log volume reduced (structured summaries; no full Lua dump loops) so Railway rate limits are not hit in steady state
- [ ] Manual Refresh via UI→queue→worker succeeds on Dev for at least one Instagram creator end-to-end
- [ ] Documented ops runbook update in `docs/infrastructure/WORKER_OPERATIONS.md`
- [ ] Remains classified as **Dev infrastructure** — no product redesign of Refresh

---

## Out of scope

- Production Railway worker changes without explicit Production deployment approval  
- Bypassing Apify budget gate or weakening fail-closed usage verification  
- Studio / Campaign Workspace redesign  

---

## Suggested investigation order

1. Infrastructure (Redis URL / host mismatch / shared Redis contention)  
2. Configuration (worker concurrency, stall interval, log level)  
3. Feature flags / env (`DISCOVERY_APIFY_MAX_*` already set to 500 on Dev)  
4. Application logging noise reduction  
5. Only then consider code changes that do not alter Refresh product contracts  

---

## Related

- Classification rule: `.cursor/rules/thinkway-infrastructure-classification.mdc`  
- Secrets / budget env: `docs/infrastructure/SECRETS_CHECKLIST.md`  
- Apify Refresh Enterprise Ready: `docs/architecture/APIFY_REFRESH_STABILIZATION_ENTERPRISE_RELEASE.md`
