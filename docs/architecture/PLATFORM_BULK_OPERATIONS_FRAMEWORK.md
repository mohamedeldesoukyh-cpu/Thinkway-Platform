# Platform Bulk Operations Framework

**Status:** Official platform capability — **canonical**  
**First production implementation:** Release 2.2d — Vendor IO Bulk Operations & Reliability (2026-08-02)  
**Reliability fix:** Release **2.2d.1** — Bulk Mark Accepted / single-refresh invariant + **idempotent execution** (2026-08-02)  
**Code:** `components/workspace/bulk-operations/`  
**Regression:** `npm run test:vendor-io-bulk`  
**Parent:** Campaign Workspace Baseline v1.3 · Architecture v1.0 · BPN Foundation  
**Companion:** [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md) — bulk actions must respect document lifecycle state / reason codes (R2.2d.2)  

---

## Purpose

Every operational register must support **one shared bulk pattern** so large campaigns (50–500+ creators) are manageable without row-by-row work, and so Ops training stays consistent across the platform.

**Influencer Marketing in Your Pocket** requires: select many → one action → background progress → partial success without losing work → safe retries without duplicate updates.

---

## Scope (must reuse this framework)

| Register | Status |
|----------|--------|
| Vendor IO | **Implemented** (first production consumer) |
| Assignments | Adopt |
| Client IO | Adopt |
| Deliverables | Adopt |
| Publications / Performance | Adopt |
| Workflow | Adopt |
| Finance | Adopt |
| Timeline | Adopt (where multi-select applies) |

**Forbidden:** Independent bulk runners, ad-hoc sequential loops without progress/partial-success, domain logic inside the shared framework.

---

## Architecture

```
components/workspace/bulk-operations/
  run-bulk-operation.ts          # Generic sequential runner + single-refresh lifecycle
  bulk-refresh-gate.ts           # Client refresh lock (survives remounts)
  bulk-defer-revalidate.ts       # FormData flag so server actions skip mid-run revalidatePath
  bulk-operation-feedback.ts     # Progress / success / failure / Retry Failed toasts
  use-platform-bulk-operation.ts # Module-level job lock (background-style)
  index.ts                       # Public exports
```

Domain modules (e.g. `features/io/bulk/`) supply only:

1. `items` + `getId`  
2. `mutate(item)` wrapping **existing** per-row server actions (with `bulk_defer_revalidate`)  
3. Optional `refresh()` — invoked **once** by the runner after all items  
4. `entityLabel` / `entityLabelPlural` for Operations-facing copy  

No API · DB · permission · BPN · Lifecycle OS architecture changes are required to adopt the framework.

---

## Bulk runner lifecycle (mandatory)

```
Start Bulk
  → Lock refresh events
  → Execute item 1 … N (every selected record)
  → Collect results
  → Unlock refresh
  → Refresh once
  → Recompute KPIs / Decision Center (via that single refresh)
  → Update selections
  → Finish
```

**No workspace refresh is allowed before completion.**

During execution there must be **no**:

- register refresh · workspace refresh · lifecycle recomputation  
- KPI / Decision Center refresh · React Query invalidation · `router.refresh()`  
- per-item `revalidatePath` from server actions (use `bulk_defer_revalidate`)

All refresh is deferred. Exactly **one** refresh runs after the runner completes.

---

## Guarantees

| Guarantee | Behavior |
|-----------|----------|
| Generic | Shared code has zero Vendor IO / Finance / etc. imports |
| Execute all | Every selected record is attempted; never stop mid-queue silently |
| Completion check | If `processed ≠ selected` → framework execution error (surfaced to Ops) |
| Partial success | Never rollback successful records |
| Progress | Live counts: processed · successful · failed · remaining |
| Background | Event-loop yields; module-level job lock; workspace stays usable |
| Single refresh | Refresh locked mid-run; one refresh after unlock |
| Diagnostics | Mutation failure ≠ refresh failure ≠ display failure |
| Retry | **Retry Failed** only — keeps failed IDs selected |
| Selection | Preserved during run; cleared only on full success or explicit Clear |
| **Idempotent execution** | Already-complete records are **skipped**, never mutated twice |

---

## Idempotent execution (mandatory invariant)

Running the same bulk action twice (Retry Failed, browser refresh, network retry, future job queues, mobile interruption, AI automation) must **never** create duplicate updates or inconsistent state.

| Example | Behavior |
|---------|----------|
| Already Accepted | Skip |
| Already Delivered Manually | Skip |
| Already Sent | Skip |
| Already Uploaded (same URL) | Skip |

Example output:

```
Selected 32
Already completed 30
Processed 2
Failed 0
```

Domain mutators implement skip checks; server actions remain safe on replay (e.g. already-approved short-circuit).

---

## Messaging standard

| Situation | Example |
|-----------|---------|
| Full success | `32 Vendor IOs were updated successfully.` |
| Partial | `29 Vendor IOs updated · 3 failed` + counts + Retry Failed |
| Idempotent re-run | `Selected 32. Already completed: 30. No failures.` |
| Execution incomplete | `Bulk execution stopped early` + Retry Failed |
| Refresh failed after success | `…were updated successfully` + “Updates were saved, but the list could not refresh…” |
| All failed | `3 Vendor IOs could not be updated` |

Never use bare technical shorthand (`32 completed`) as the primary Operations message.

---

## Capability completeness gates (mandatory)

Every new Thinkway capability must answer **before** it is considered complete:

1. **Can this process be done in bulk?** — Never ship single-record-only operations for register work.  
2. **Can this process run in the background?** — Do not block the user while work executes.  
3. **Can this process eventually be automated by AI?** — Design hooks/contracts so AI can recommend or execute later (do not implement AI in this framework yet).  
4. **Does this reduce operational effort?** — If it adds clicks or manual work, redesign.  
5. **Is execution idempotent?** — Retries and re-runs must skip already-complete records; never duplicate side effects.

These gates are also recorded in [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md).

---

## Root cause fixed in 2.2d.1

Bulk Mark Accepted called `revalidatePath` inside each per-row server action. Next.js RSC refresh remounted the workspace mid-loop and aborted remaining mutations.

**Fix:** `bulk_defer_revalidate` on bulk FormData + client `bulk-refresh-gate` so operational refresh / `router.refresh()` are no-ops until the runner finishes, then refresh once.

---

## Vendor IO bulk actions (audit — all use shared runner)

| Action | Shared runner |
|--------|---------------|
| Send Vendor IO | Yes |
| Mark Accepted | Yes |
| Mark Delivered Manually | Yes (same send mutator path) |
| Upload Signed Documents | Yes |
| Change Payment Terms | Yes |
| Export Selected | Local CSV (no mutation runner) |
| Future Finance / Deliverables / Assignment bulk | Must use this framework |

---

## Operational effort opportunities (document only — do not implement AI yet)

| Bulk action (Vendor IO) | Eliminate? | AI later? | Automate later? | One-click vs many |
|-------------------------|------------|-----------|-----------------|-------------------|
| Send / Mark Delivered Manually | Partial — still needs human judgment for exceptions | Recommend send-ready vs manual | Auto-send when email valid + Client approved | **One** for N rows (done) |
| Mark Accepted | Yes for WhatsApp/phone confirmations if channel signals exist | Infer offline acceptance from activity | Auto-accept after signed URL + ops policy | One for N (done) |
| Upload Signed Documents | Paste URL still manual | Extract signed PDF from Drive folder | Folder watch → attach | One URL → N (done) |
| Change Payment Terms | Often campaign-default | Suggest terms from vendor profile | Inherit brand/vendor defaults | One for N (done) |
| Export Selected | Reporting job | — | Scheduled export | One (done) |
| Add Note | Detail still required | Draft note from call summary | — | Open detail (interim) |
| View IO | Preview flood at scale | — | Single combined PDF | Cap + confirm (done) |

---

## Adoption recipe (future registers)

```ts
const { run, isRunning } = usePlatformBulkOperation();

void run({
  label: "Approve Selected",
  items: selectedRows,
  getId: (row) => row.id,
  mutate: async (row) => {
    // Prefer idempotent skip before calling the server action.
    // Pass bulk_defer_revalidate on FormData for existing actions.
    return existingPerRowAction(row);
  },
  entityLabel: "Deliverable",
  entityLabelPlural: "Deliverables",
  refresh: safeRefresh,
  onComplete: (summary) => {
    if (summary.failedIds.length) retainIds(summary.failedIds);
    else if (summary.succeeded) clearSelection();
  },
  onRetryFailed: (failedIds, mutate) => { /* re-run failed only */ },
});
```

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | Presentation / ops robustness across S09–S10 (Vendor IO) first; pattern reusable S06–S16 |
| Stakeholder Journey(s) extended | Internal Ops · Commercial · Finance |
| Business Process component(s) reused | Campaign Workspace registers; Decision Center unchanged |
| Workspace(s) extended | Campaign Workspace operational registers |
| Baseline documents referenced | Architecture v1.0; BPN; Campaign Workspace Baseline v1.3 |
| No new navigation philosophy | Floating selection bar already platform-standard |
| No duplicate workflow | Wraps existing per-row actions only |
| Lifecycle extension | None — ops UX only |
| Operational effort — eliminated | Row-by-row send/accept/signed/terms for large selections |
| Operational effort — simplified | One toolbar + background progress + Retry Failed + safe re-run |
| Operational effort — remains human | Exception handling, commercial judgment, signed-doc sourcing |

---

## Next

1. Adopt framework on Assignments and Deliverables (highest volume).  
2. Keep Vendor IO as the reference implementation.  
3. Do **not** invent parallel bulk systems.
