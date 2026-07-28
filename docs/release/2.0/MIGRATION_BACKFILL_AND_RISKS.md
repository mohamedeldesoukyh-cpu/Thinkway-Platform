# Release 2.0 — Migration, Backfill & Risks

**Status:** Pre-implementation — awaiting approval  
**Parent:** [RELEASE_2_0_ARCHITECTURE.md](./RELEASE_2_0_ARCHITECTURE.md)  
**DB policy:** Development (`hsxrewjcbvmbkqdlzjhs`) first. Production (`ienowhwfyxoqtzbgltno`) only with explicit approval.

---

## 1. Migration strategy

### 1.1 Principles

| Principle | Application |
|---|---|
| Additive first | Nullable columns + new table; no drops in Phase 1 |
| Dual-read | Code tolerates null provenance forever for legacy rows |
| Feature flag | Convert new behavior behind `release_2_0_assignment_convert` |
| No silent financial rewrites | Backfill never changes invoiced/locked amounts |
| Dev → QA → approved Prod | Standard release workflow |

### 1.2 Proposed migration set (Dev)

**Migration A — Provenance columns**

```text
campaign_headers
  + accepted_quotation_id uuid NULL REFERENCES quotations(id)
  + accepted_quotation_version int NULL
  + indexes

campaign_lines
  + source_quotation_id uuid NULL REFERENCES quotations(id)
  + source_quotation_item_id uuid NULL REFERENCES quotation_items(id)
  + indexes
```

**Migration B — Commercial snapshot**

```text
campaign_commercial_snapshots (
  id uuid PK,
  campaign_header_id uuid NOT NULL REFERENCES campaign_headers(id),
  quotation_id uuid NOT NULL REFERENCES quotations(id),
  quotation_serial text,
  version_number int,
  payload jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz
)
+ RLS: same org/access pattern as campaign_headers select/insert
```

**Migration C (optional Phase 1)** — Deliverable ops fields

```text
assignment_deliverables
  + service_description text NULL
  + free_for_client boolean NULL DEFAULT false
```

### 1.3 Rollback

| If | Rollback |
|---|---|
| App bug with flag on | Turn flag off — legacy Path A behavior retained until removed |
| Migration defect in Dev | `supabase` repair / fix-forward migration (never edit applied Prod migration) |
| Prod issue post-migrate | Columns/table are additive — app can ignore; no destructive rollback required |

Do **not** plan DROP of new columns in emergency; fix-forward.

---

## 2. Backward compatibility matrix

| Existing shape | After Phase 1 | User impact |
|---|---|---|
| Manual Assignments (no quote) | Unchanged | None |
| Path A: header + influencers, **zero lines** | Still loads; CTA to backfill Assignments | Ops can complete billing path |
| Path B: lines, missing quote FK | Lines remain; optional link repair | Audit trail improved |
| Quote linked, lines exist, no source_* | Valid; provenance null | None |
| Invoiced / VIO-linked lines | Untouched by convert/backfill amount logic | Protected |
| QT V2 sharing `campaign_header_id` | Unchanged; no auto Apply | Banner later (1.5) |

---

## 3. Backfill strategies (D5 — never silent)

### 3.1 Tier 0 — Compatible null provenance

Legacy campaigns keep working. Provenance null is allowed.

### 3.2 Tier 1 — Automatic detection + user choice (Phase 1)

**Detect when:** Campaign looks pre–Release 2.0 — e.g. `quotation_id` set AND count(Assignments/`campaign_lines`) = 0 (Path A shape), or equivalent heuristic.

**UI:**

> This Campaign was created before Release 2.0 and does not contain Assignments.

**Button:** `Backfill Assignments` — user chooses; never auto-execute.

### 3.3 Tier 2 — Dry run (Phase 1 wizard step)

Before execute, show:

- Assignments to create (incl. package → one Assignment)  
- Deliverables  
- Commercial snapshot preview  
- Warnings (missing influencers, skipped alternative options, currency mismatch)

No writes in Tier 2.

### 3.4 Tier 3 — Execute (Phase 1 wizard confirm)

- Same convert/backfill service with `reuseHeaderId`  
- Full `audit_logs`  
- Skip if lines already exist; do not delete existing influencers; link where match  

### 3.5 Link repair (Path B) — optional admin

For headers with `campaign_object_id` and a quotation with matching `campaign_object_id` but null `quotation_id`:

- Set `quotation_id` + `accepted_quotation_*` from that quotation  
- Optionally match lines↔items by `influencer_id` + amounts to set `source_quotation_item_id` when unique  

Never overwrite non-null provenance.

### 3.6 Explicitly out of scope for backfill

- Rebuilding Collap package structure historically  
- Rewriting invoice line items  
- Moving historical Actual Media Plan data  
- Creating Assignments from shortlist alone without quote (already a separate flow)

---

## 4. Risk register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | Convert creates wrong PO amounts → bad VIO/invoice | Critical | Medium | Mapper tests; preview UI; flag; Dev smoke with finance |
| R2 | Duplicate campaigns from double-click / dual Path A+B | High | Medium | Idempotency on accepted pin + existing header |
| R3 | Orphan influencers + new lines duplicate vendors | Medium | Medium | Match existing influencer on header before insert |
| R4 | Quote currency ≠ brand currency silent mismatch | Medium | Medium | Surface warning; store item currency on line |
| R5 | Multi-option quotes create duplicate creators | Medium | High | D1/D2 option policy; default selected option only |
| R6 | Collap followers become zero-revenue junk lines | Medium | Medium | Leader-only Assignment rule |
| R7 | Media Plan slate diverges from Assignment PO | Medium | High | Banner; do not auto-write lines from plan |
| R8 | Apply revision (future) mutates locked lines | Critical | Low if gated | Hard skip invoiced/locked; reuse VIO reopen |
| R9 | RLS gap on snapshots leaks commercials | High | Low | Copy campaign_headers policies; test with non-member |
| R10 | Large quotes timeout on convert | Medium | Medium | Batch creates; progress messaging; limit alerts |
| R11 | Feature flag off in Prod while Dev differs | Low | Medium | Ops Center note; release checklist |
| R12 | Docs/UI still say “Create campaign” vs Assignments | Low | High | Copy pass in Phase 1 UI PR |
| R13 | AI copilot rewrites commercials from quote | Medium | Medium | Context guard when lines exist |
| R14 | Production migrate before Dev soak | Critical | Process | Policy + approval checklist |

---

## 5. Compatibility test plan

| # | Scenario | Expected |
|---|---|---|
| C1 | Legacy campaign no quote | Unaffected |
| C2 | Path A legacy (influencers, 0 lines) | Loads; backfill CTA; after backfill VIO possible |
| C3 | Fresh convert Phase 1 | Lines + deliverables + snapshot + pin |
| C4 | Repeat convert | `alreadyExists` |
| C5 | Path B with linked quote | Lines + quote FKs set |
| C6 | Invoiced line campaign | Backfill/convert does not alter locked amounts |
| C7 | QT V2 generated | Campaign unchanged |
| C8 | Media Plan Actual | Still tracks Performance after convert |
| C9 | Flag off | Old Path A behavior (until removed) |

---

## 6. Data impact estimates (qualitative)

| Population | Expected | Handling |
|---|---|---|
| Quotes with `campaign_header_id` and 0 lines | Primary backfill candidates | Tier 1 CTA |
| Quotes with campaign + lines | Provenance optional | Tier 3 match when safe |
| Campaigns never from quote | Majority of historical ops | No action |
| In-flight VIOs/invoices | Must remain stable | No amount backfill |

Run quantitative counts on **Development** after approval (SQL report in Phase 1.5 runbook) before any Prod backfill.

---

## 7. Communication & rollout

1. Architecture approval  
2. Feature branch implementation on Dev  
3. Internal soak: convert → Assignment → VIO → invoice on Dev data  
4. Flag on for Dev/staging users  
5. Release notes: “Create campaign now creates Assignments (lines)”  
6. Production app deploy + migrations **only with explicit approval**  
7. Optional Prod Tier 1 CTA enabled; Tier 2 batch separately approved  

---

## 8. Decisions

**Locked** — [DECISIONS.md](./DECISIONS.md). Field ownership — [FIELD_OWNERSHIP_MATRIX.md](./FIELD_OWNERSHIP_MATRIX.md).
