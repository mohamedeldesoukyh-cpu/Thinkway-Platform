# Creator CRM ↔ Discovery — Final Architecture (Pre-Implementation)

**Status:** Architecture locked · Product decisions signed off · Phase 1 **CLOSED** (`CREATOR_CRM_PHASE1_MILESTONE.md`) · Phase 2 proposal gated on review  
**Date:** 2026-07-27  
**Supersedes / extends:** `CREATOR_CRM_DISCOVERY_SEPARATION_PROPOSAL.md`  
**Platform validation:** [CRM vs platform explore](ef94d45b-7869-4698-adce-02a3ed2646f6)  
**Canvas:** `creator-crm-architecture-proposal.canvas.tsx`  
**Phase 1 plan / milestone:** `CREATOR_CRM_PHASE1_IMPLEMENTATION_PLAN.md` · `CREATOR_CRM_PHASE1_MILESTONE.md`  
**Phase 2 proposal (pending approval):** `CREATOR_CRM_PHASE2_IMPLEMENTATION_PROPOSAL.md`

---

## 0. Verdict

The soft-split proposal is **approved**. Product decisions in §16 are **closed**. There are **no remaining architectural blockers** before Phase 1 schema work.

| Decision | Choice |
|---|---|
| Identity spine | Keep `influencers` |
| Discovery crawl pool | Keep `discovered_profiles` long-term (do not merge tables) |
| Commercial gate | New `creator_crm_profiles` + sole service `ensureCommercialCreator()` |
| Creator CRM list | Activated CRM only |
| Discovery browse / DNA / AI / Studio | Full identity spine (no CRM required) |
| Hard-split second master table | Rejected for Phase 1–2; revisit only at 1M+ if CRM itself is huge |

**Do not implement until this document’s open questions (§15) are answered.**

---

## 1. Architecture review (platform-wide)

| Area | Soft-split fit | Notes |
|---|---|---|
| Discovery Search / browse | KEEP | Unified `inf:`/`dis:`; pool stays influencers-first + discovered |
| Creator DNA | KEEP + gap | PK = influencer_id; **staging→DNA merge on promote is unfinished** — fix alongside CRM |
| AI Matching / Campaign Intelligence | KEEP | Uses CreatorIntelligence / unified ids; no CRM dependency |
| Campaign Studio | KEEP | Hydrates `inf:`/`dis:`; slate commit drops `dis:` until identity promote |
| Shortlists | KEEP + tighten | Dual-key items; **no CRM on add**; CRM on move-to-campaign |
| Quotations | CHANGE triggers | Draft item sync must **not** CRM-activate; activate on campaign create / approved commercial commit |
| Assignments | KEEP | `campaign_influencers.influencer_id` NOT NULL → CRM activate |
| Vendor IO | KEEP | Activate on VIO create |
| Payments / finance docs | KEEP | `vendor_id` → influencers; bank save → CRM |
| Reporting | CHANGE | CRM reports filter profiles; intelligence top-creators may still use full spine |
| Performance | REQUIRED | CRM counts via `creator_crm_profiles`, never exact-count 7k under RLS |
| Security / RLS | KEEP + extend | Reuse influencers RLS; CRM is data gate + optional column policies later |
| Creator portal | ADD reason | Portal invite / first link → CRM activate |
| Marketplace / booking | N/A now | No schema; don’t invent FKs; leave extension points on CRM profile |
| Agencies | KEEP | `influencers.agency_id`; treat as CRM completeness |

---

## 2. Proposal review — weaknesses found

1. **“Quotation item commercialized” was too loose** — shortlist→quotation sync already writes commercial fields on draft items; activating there would pull Discovery shortlists into CRM early.  
2. **Naming collision** — Apify helper `ensureCommercialCreatorFromApifyData` creates **identity**, not CRM. Must rename before shipping CRM service.  
3. **Identity promote ≠ CRM** was stated but easy to violate in call sites (enrichment/promote paths).  
4. **`influencers.status` overload** — browse eligibility flips to `active`; cannot be CRM lifecycle.  
5. **DNA staging gap** — soft-split increases Discovery-only lifetime; unfinished staging promote becomes more painful.  
6. **No audit stream** — activation needs an append-only event log for finance/compliance.  
7. **No denormalized list key** — CRM list at 100K identity still fine with join; add `has_commercial_profile` boolean maintained by trigger for index simplicity.  
8. **Future orgs/talent managers** — CRM profile should allow `managed_by_agency_id` / `commercial_owner` without forcing a new identity table later.

---

## 3. Recommended improvements (vs original proposal)

| # | Improvement | Why |
|---|---|---|
| 1 | **Three layers**, not two surfaces on one muddy status | Identity · Discovery presence · Commercial CRM |
| 2 | **Tighten activation events** (see §7) | Prevent shortlist/draft quote leakage |
| 3 | **`creator_crm_activation_events` audit table** | Idempotent + auditable |
| 4 | **Rename Apify identity helper** | Avoid wire-up disasters |
| 5 | **Finish DNA staging promote** in same program (Phase 2b) | Data integrity |
| 6 | **Stop using `influencers.status` for CRM** | Browse ≠ commercial |
| 7 | **Boolean denorm `influencers.has_commercial_profile`** | Fast CRM filters + partial indexes |
| 8 | **CRM activation on portal invite** | Creator-facing commercial relationship |
| 9 | **Future columns on CRM profile now** | `managed_by_agency_id`, `preferred_currency`, `onboarding_source` — nullable |
| 10 | **Feature flag + dry-run backfill** | Safe Production cutover |

---

## 4. Alternative architectures (re-evaluated)

| Option | Verdict | When to reconsider |
|---|---|---|
| A. Soft-split + CRM profile | **Selected** | — |
| B. Hard-split `commercial_creators` rewriting FKs | Rejected | Only if CRM rows approach identity scale |
| C. Force all Discovery onto `discovered_profiles` only | Rejected | Breaks DNA PK, import, browse pool |
| D. View filter without lifecycle | Rejected | No Incomplete / completeness / audit |
| E. CRM as Postgres VIEW of “has commercial signal” | Rejected as sole model | No Incomplete onboarding before first deal artifact |

---

## 5. Final recommended architecture

### 5.1 Three layers

```
┌──────────────────────────────────────────────────────────────┐
│ L1 Creator Identity — influencers (+ platform_accounts)      │
│     Assignable · INF-* · DNA target · shared demographics      │
└─────────────────┬────────────────────────────┬───────────────┘
                  │                            │
                  ▼                            ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ L2 Discovery presence       │  │ L3 Commercial CRM           │
│  discovered_profiles link   │  │  creator_crm_profiles       │
│  browse eligibility         │  │  crm_status · completeness  │
│  shortlists · AI · match    │  │  activation events · gates  │
│  (may exist without L3)     │  │  (Creator CRM UI only)      │
└─────────────────────────────┘  └─────────────────────────────┘
```

### 5.2 ERD (logical)

```
agencies 1──* influencers
influencers 1──* influencer_platform_accounts
influencers 1──0..1 creator_dna
influencers 1──0..1 creator_crm_profiles
influencers 1──* creator_crm_activation_events
discovered_profiles *──0..1 influencers  (influencer_id)
discovery_shortlist_items → profile_id? | influencer_id?
quotation_items → influencer_id? | profile_id?
campaign_influencers → influencer_id (required)
vendor_ios → influencer_id (required)
finance_documents.vendor_id → influencers
```

### 5.3 Sole commercial entry: `ensureCommercialCreator`

```ts
ensureCommercialCreator({
  influencerId: string,           // required after identity resolve
  reason: CrmActivationReason,
  actorId: string | null,
  sourceEntityType?: string,
  sourceEntityId?: string,
  initialStatus?: 'incomplete' | 'active', // default incomplete
}): Promise<{ profile: CrmProfile; created: boolean; eventId: string }>
```

**Guarantees**

- Idempotent on `influencer_id`  
- Single transaction: upsert profile + insert activation event (skip duplicate event if same reason+source within window or unique constraint)  
- No CRM logic outside this module  
- Optional wrapper `ensureCommercialCreatorFromDiscoveredProfile` = identity promote **then** CRM (only for explicit commercial paths)

**Rename today:** `ensureCommercialCreatorFromApifyData` → `ensureIdentityCreatorFromApifyData` (or equivalent) **before** shipping CRM.

---

## 6. Commercial lifecycle (improved)

```
L3 absent = Discovery-only (or identity-only without CRM)

incomplete  →  prospect  →  negotiating  →  active  →  preferred
                 │              │             │
                 └──────────────┴─────────────┴──→ inactive
                                                   do_not_use
```

| Status | Meaning | Typical entry |
|---|---|---|
| *(no profile)* | Not in Creator CRM | Default for imports |
| `incomplete` | Commercialized; master data missing | Auto-activation |
| `prospect` | Pipeline, not in active negotiation | AM advances |
| `negotiating` | Live deal discussion | AM advances |
| `active` | Worked / working with Thinkway | VIO paid / multiple campaigns / manual |
| `preferred` | Priority roster | Manual / rule-assisted |
| `inactive` | Off roster | Manual |
| `do_not_use` | Compliance / quality block | Admin |

**Transition rules (MVP)**

- System may set `incomplete` on activation; may suggest `active` when first VIO issued or payment recorded (configurable).  
- All other transitions: authorized roles (`influencers.write` / finance for do_not_use).  
- `do_not_use` blocks new assignments (enforce in assignment actions).

**Not added as statuses:** separate “onboarding” (use incomplete); “archived” stays on identity soft-delete if needed.

---

## 7. Promotion / activation event matrix (final)

| Event | Identity | CRM activate? | Justification |
|---|---|---|---|
| Discovery / Apify / manual import / URL-add | Creates/updates influencer | **Never** | Intelligence inventory |
| Enrichment / DNA / AI acquisition | May promote identity | **Never** | Intelligence |
| Discovery Search / match / Studio slate | Neither required | **Never** | Planning |
| Shortlist add (Discovery or campaign-linked) | Optional | **Never** | Exploration |
| Shortlist → Campaign (assignment create) | Promote if needed | **Yes** | Operational commitment |
| Draft / pricing-approved quotation (incl. shortlist sync) | May set influencer_id | **No** | Not operational yet |
| Quotation becomes **operational** (converted to campaign / committed into ops) | Promote if needed | **Yes** | Locked product decision |
| Campaign assignment insert | Required | **Yes** | Ops |
| Vendor IO create | Required | **Yes** | Contractual; does **not** auto-advance status to Active |
| Payment details / contract save | — | **Only if already CRM, or writer may Convert** | Finance consumes CRM; must not create via Convert |
| Creator portal invite / link | — | **Yes** | Commercial relationship (AM/Ops/Admin path) |
| Manual Convert / Create Commercial | Yes | **Yes** — AM, Ops, Admin only | Finance excluded |
| Identity promote alone | Yes | **No** | Assignability ≠ CRM |
| First Vendor IO issued | — | Profile may already exist | System may **recommend** Active; never auto-transition |

---

## 8. Shortlist architecture

**Do not create a second shortlist product table.**

Use existing model:

| Kind | Signal | CRM |
|---|---|---|
| Discovery shortlist | `campaign_header_id` null | Never activate |
| Campaign shortlist | `campaign_header_id` set | Still **no** activate on add |
| Operationalize | Move/approve → `campaign_influencers` | Activate here |

UX labels: “Discovery shortlist” vs “Campaign shortlist” (same tables).

---

## 9. Campaign workflow (activation points)

```
Discovery Creator (L1 and/or L2)
        │
        │ shortlist (no CRM)
        ▼
   Quotation draft / pricing-approved (no CRM)
        │ operational commit (→ campaign)
        ▼
 ensureCommercialCreator(incomplete)  ◄── assignment, VIO create, portal, Convert (AM/Ops/Admin)
        │
        ▼
 Assignment → Vendor IO → Execution → Payments
        │
        ▼
 crm_status advances only by explicit business action
 (system may recommend Active after VIO; never auto)
```

---

## 10. Completeness engine (design)

### Dimensions & weights (v1)

| Dimension | Weight | Required for |
|---|---|---|
| Identity (legal name, country) | 15 | incomplete→prospect |
| Platforms (≥1 primary) | 10 | assignment |
| Contact (email or phone) | 15 | VIO send |
| Agency link / management | 5 | — |
| Rates / rate_card | 10 | quotation assist |
| Legal | 10 | VIO send (market-dependent) |
| Tax | 10 | payment |
| Bank / payment_details | 15 | payment / VIO send |
| Contracts / documents | 5 | — |
| Vendor IO defaults | 5 | — |

History (campaigns/payments) is **informational**, not weighted into % (shown as badges).

### Automation

- Recompute on CRM profile save and on relevant influencer field updates (debounced job or trigger).  
- Store `completeness_score`, `completeness_missing jsonb`, `completeness_updated_at`.  
- Blocking rules enforced in server actions (not only UI).

---

## 11. Migration strategy

### Who becomes Commercial

Activate if **any genuine commercial activity**:

- `campaign_influencers` row  
- `vendor_ios` row  
- `finance_documents.vendor_id` / vendor credit-debit notes (vendor side)  
- Quotation that was **operationally converted to a campaign** (not draft, not pricing-only approval)  
- `influencers.profile_id` linked (creator portal)  
- Non-empty `payment_details` **only when** the creator already has other commercial signals or was Converted (do not backfill bank-only Discovery noise)

**Remain Discovery-only:** import-only, DNA-only, shortlist-only, **draft / non-operational quotations**.

### Historical preservation

- No deletes  
- Activation events with `reason='backfill'` + source refs  
- Dry-run CSV/report before apply  

### Rollback

- Feature flag off → CRM list shows all influencers (legacy) **or** empty CRM with banner (choose: prefer flag-off = legacy full list for safety)  
- `TRUNCATE creator_crm_profiles` / delete backfill events (identity untouched)

### Expected Prod volume

~110–150 CRM profiles initially (not 7k).

---

## 12. Performance

| Scale | Strategy |
|---|---|
| 10K identity / ~150 CRM | Join + `creator_crm_profiles(activated_at DESC)` |
| 100K identity | Same; Discovery keeps browse RPCs; CRM never scans full table |
| 1M identity | Partition Discovery browse; CRM remains subset; consider hard-split only if CRM >100K |

**Indexes**

- PK `creator_crm_profiles(influencer_id)`  
- `(crm_status, activated_at DESC)`  
- Partial: `influencers(created_at DESC) WHERE has_commercial_profile`  
- Keep `vendor_list_total_count` rewritten to count CRM profiles  

**Avoid:** PostgREST exact count on full `influencers` for CRM.

---

## 13. Security

- Activation requires `influencers.write` **or** `campaigns.write` / quotation write / finance write depending on reason (matrix in Phase 2).  
- `ensureCommercialCreator` runs as authenticated user; RLS on insert to `creator_crm_profiles` must allow those roles.  
- Bank/legal tabs: existing finance permissions; no bypass via activation.  
- Do not reintroduce `USING (true)` influencer policies.  
- Audit events readable by admin/finance.

---

## 14. UI / UX

| Role | Experience |
|---|---|
| Account Manager | Discovery → shortlist → quote; Convert / auto-CRM on campaign; Completeness strip |
| Operations | Creator CRM Incomplete queue; assignment blocked if do_not_use |
| Finance | CRM filter; bank/tax gates before pay / VIO send |

- Nav: **Creator CRM** (redirect `/vendors` → `/creators` or alias)  
- Badges: CRM status + completeness %  
- Discovery actions: Shortlist · Add to Campaign · Convert to Commercial · Open CRM profile  

---

## 15. Future readiness (schema now)

Nullable extension fields on `creator_crm_profiles`:

- `managed_by_agency_id`  
- `commercial_owner_profile_id` (talent manager)  
- `preferred_currency`  
- `onboarding_source`  
- `negotiation_notes` (text) — defer full negotiations module  

Do **not** create marketplace/booking tables now. Do **not** split payments off `influencers` FKs.

Long-term: commercial-sensitive columns may migrate from `influencers` → CRM profile; Phase 1 keeps columns on influencers with CRM UI ownership.

---

## 16. Locked product decisions (2026-07-27)

| # | Topic | Decision |
|---|---|---|
| 1 | Quotation → CRM | Activate **only when quotation becomes operational** (e.g. converted into a campaign / ops-committed). **Not** draft. **Not** pricing-only approval. |
| 2 | Feature flag OFF | Keep **current Vendors experience** (full identity list) as safe rollback. |
| 3 | Canonical route | **`/creators`** long-term; **`/vendors` → redirect** for compatibility. |
| 4 | Who may Convert | **Account Manager, Operations, Admin/Super Admin.** Finance consumes CRM; **cannot** Convert/Create commercial creators. |
| 5 | Incomplete → Active after first VIO | **No auto-transition.** System may **recommend**; explicit business decision required. |
| 6 | Historical backfill | **No draft quotations.** Only creators with **genuine commercial activity** (assignments, VIO, finance vendor docs, operational quotation→campaign, portal link). |

**Blockers:** none remaining for Phase 1 schema planning/execution after this lock.

---

## 17. Phased implementation plan

### Phase 1 — Schema (+ service stubs contract)
**Detail:** `CREATOR_CRM_PHASE1_IMPLEMENTATION_PLAN.md`  
**Scope:** enums, `creator_crm_profiles`, `creator_crm_activation_events`, `has_commercial_profile` + trigger, indexes, RLS stubs, types, feature-flag constant, `ensureCommercialCreator` interface + tests against schema (no workflow wiring yet).  
**Risks:** migration on Prod influencers table locks — use additive DDL.  
**Validation:** schema tests; EXPLAIN CRM count.  
**Rollback:** drop new tables/columns (additive-safe).

### Phase 2 — Backend services
**Scope:** `ensureCommercialCreator`, rename Apify identity helper, DNA staging merge on identity promote, permission matrix, unit tests.  
**Risks:** missed call sites.  
**Validation:** idempotency tests; no CRM on import/shortlist fixtures.  
**Rollback:** feature flag disables writers.

### Phase 3 — Migration
**Scope:** dry-run backfill → apply → report.  
**Risks:** over/under activation.  
**Validation:** counts vs SQL signals; sample audit.  
**Rollback:** delete backfill-tagged profiles/events.

### Phase 4 — Discovery
**Scope:** UI copy; Convert action; ensure shortlist/import paths do not CRM-activate; Studio/match unchanged.  
**Risks:** AM confusion.  
**Validation:** Discovery E2E shortlist without CRM row.  
**Rollback:** hide Convert; flag off.

### Phase 5 — Creator CRM
**Scope:** canonical `/creators` (+ `/vendors` redirect); list join CRM when flag ON; status badge; completeness strip v1.  
**Risks:** empty list if Phase 3 skipped.  
**Validation:** list ~backfill size; detail opens.  
**Rollback:** flag OFF → legacy full Vendors/Creators list.

### Phase 6 — Campaign integration
**Scope:** wire ensure on assignment, quotation→campaign, VIO; do_not_use block.  
**Risks:** double activation races (unique PK handles).  
**Validation:** new assignment creates Incomplete profile.  
**Rollback:** stop calling ensure (profiles remain).

### Phase 7 — Operations
**Scope:** Incomplete queue, transition actions, portal invite reason, bank/VIO gates.  
**Risks:** over-blocking Finance.  
**Validation:** gate tests.  
**Rollback:** gates soft-warn mode.

### Phase 8 — Reporting
**Scope:** CRM dimension on vendor reports; fix deep links.  
**Risks:** report empty sets.  
**Validation:** finance smoke.  
**Rollback:** reports use full spine with label.

### Phase 9 — Production rollout
**Scope:** flag on → monitor → remove legacy list path → docs/training.  
**Risks:** Ops expectation mismatch.  
**Validation:** Production smoke checklist (Discovery + CRM + Campaign + VIO).  
**Rollback:** flag off within RTO.

---

## 18. Risks (summary)

| Risk | Severity | Mitigation |
|---|---|---|
| Over-activation from draft quotes | High | Tight matrix §7 |
| Name collision with Apify helper | High | Rename first |
| Empty CRM if filter before backfill | High | Ordered phases + flag |
| DNA staging data loss | Medium | Phase 2b merge |
| AM expects old Vendors = all creators | Medium | Training + Convert |
| RLS timeout regress | Medium | Count CRM table only |

---

## 19. Backward compatibility

- All existing FKs unchanged  
- INF URLs keep resolving  
- Discovery browse unchanged  
- Vendor IO / invoices / payments unchanged  
- `/vendors` redirects during rename window  

---

## 20. Go-ahead

1. Architecture + product decisions are **locked** (§16).  
2. **Phase 1 CLOSED** — see `CREATOR_CRM_PHASE1_MILESTONE.md` / `CREATOR_CRM_PHASE1_SIGN_OFF.md`.  
3. Next step: review and approve **Phase 2 implementation proposal** before any workflow wiring.  
4. Phase 2 must rename Apify identity helper; DNA staging promote remains in-scope for Phase 2b.  
5. Do not enable CRM list filter or backfill until later approved phases.

**Phase 1 architectural blockers:** none remaining.
