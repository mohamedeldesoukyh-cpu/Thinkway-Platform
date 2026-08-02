# Prompt Summary — Current Sprint

**Branch focus:** `develop` (synced with `origin/develop`).  

**Closed permanently:** **Enterprise Document & Change Impact** initiative (R2.2d.2 / 2.2d.2b) — both engines in **Maintenance Mode**. Freeze tip `449fd5c0`.

| Engine | Status | Spec |
|--------|--------|------|
| Enterprise Change Impact | Maintenance Mode · frozen · mandatory | `docs/architecture/ENTERPRISE_CHANGE_IMPACT_ENGINE.md` |
| Enterprise Document Lifecycle | Maintenance Mode · frozen · mandatory | `docs/architecture/ENTERPRISE_DOCUMENT_LIFECYCLE.md` |
| Platform Capability Registry | Canonical | `docs/architecture/PLATFORM_CAPABILITY_REGISTRY.md` |

**Extension rule:** Quotation · PO · Invoice · Contract · Reports must **extend** these engines — never parallel implementations.  
**Do not:** Production deploy · start Quotation/PO/Invoice/Contract/Reports · start Planning Workspace implementation without approved reviews.

**Active initiative (reviews only):** Release 2.3 — Campaign Planning Workspace — Capability / UX / Spec / Compliance reviews · **no Campaign Workspace UX** · **no Planning implementation until approved**.  
**Must inherit:** Campaign Workspace Baseline **v1.3** · Platform Bulk Operations Framework · Change Impact · Document Lifecycle · BPN · Architecture v1.0.

**Capability completeness gates:** Bulk · Background · AI-ready · Operational effort · Idempotent execution (all five required).

**Platform Bulk Framework:** `docs/architecture/PLATFORM_BULK_OPERATIONS_FRAMEWORK.md` — Vendor IO (R2.2d / 2.2d.1).

**Gate docs (Planning — retargeted as R2.3):**  
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`  
- `docs/capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md`  

## Media Planning v1 — RELEASED TO PRODUCTION

- **Canonical SSOT:** `docs/architecture/MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`
- Feature freeze unless requirements approved

## Open / blocked

1. GitHub branch protection (UI)
2. Production `REDIS_URL` / dedicated Dev Redis / DNS as needed
3. Do **not** merge to `main` or deploy Production without explicit approval

## Campaign Workspace Baseline v1.3 — FROZEN (Maintenance Mode)

- **Canonical:** `docs/architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.3.md`
