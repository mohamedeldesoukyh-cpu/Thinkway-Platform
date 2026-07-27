# Creator CRM ↔ Discovery Separation — Architecture Proposal

**Status:** Superseded for implementation planning by `CREATOR_CRM_FINAL_ARCHITECTURE.md`  
**Date:** 2026-07-27  
**Audience:** Product + Engineering  
**Related canvas:** Cursor canvas `creator-crm-architecture-proposal.canvas.tsx`  

> **Read next:** [CREATOR_CRM_FINAL_ARCHITECTURE.md](./CREATOR_CRM_FINAL_ARCHITECTURE.md) — platform-validated architecture with tightened activation matrix and phased plan.

---

## Executive recommendation

**Adopt a soft split with two explicit gates:**

1. **Identity gate (exists):** `discovered_profiles` ↔ `influencers` via `promoteDiscoveredProfileToInfluencer` (keep; stop treating it as CRM entry).  
2. **Commercial CRM gate (new):** `ensureCommercialCreator` / `creator_crm_profiles` — only this makes a creator appear in **Creator CRM**.

Keep `influencers` as the assignable identity spine (required for `campaign_influencers`, VIO, DNA). Discovery may still browse `influencers` for imported catalog **without** CRM activation. Creator CRM lists only commercially activated creators.

**Phase 1 do not:** rewrite FKs into a second master table, or force all Discovery back onto `discovered_profiles` only (would re-home import/DNA).

**Rename** UI “Vendors” → **Creator CRM** (table `influencers` + INF numbers retained).

---

## 1. Current architecture assessment

### 1.1 Spine today

| Concern | Storage | Notes |
|---|---|---|
| Creator identity | `public.influencers` | INF-* document numbers; ~7,086 Prod rows |
| Platforms | `influencer_platform_accounts` | FK → influencers |
| Intelligence | `creator_dna`, enrichment, IPL | Mostly keyed by influencer_id |
| Parallel Discovery | `discovered_profiles` | ~1,845 rows; not the Vendors list source |
| Shortlists | `discovery_shortlists` / `discovery_shortlist_items` | Can reference `influencer_id` |
| Quotations | `quotation_items.influencer_id` | Commercial pricing |
| Assignments | `campaign_influencers` | Operational |
| Vendor IO | `vendor_ios.influencer_id` | Contractual |
| Commercial UI | `/vendors` → `getVendorsList()` | Selects **all** influencers |

### 1.2 Intended vs actual ingestion (updated from codebase exploration)

**Original Discovery design** (`20260611015000_discovery_engine.sql`, `lib/discovery/promote-profile.ts`):

- Pool creators in `discovered_profiles` (nullable `influencer_id`).
- Promote via `promoteDiscoveredProfileToInfluencer` when assignable (shortlist → campaign, quotation → campaign, plan generators).
- Shortlist add can store `profile_id` only; assignment requires `influencer_id` (`isAssignableCreator`).

**What happens in practice:**

| Path | Lands in | Sets status |
|---|---|---|
| Import Center | `influencers` directly | `active` |
| Apify dataset import | `influencers` (+ often links `discovered_profiles`) | `active` |
| Add by profile URL | `influencers` | minimal / active path |
| Manual Vendors create | `influencers` | as created |
| `promoteDiscoveredProfileToInfluencer` | creates/links `influencers` | **`active`** + browse eligibility |
| `ensureDiscoveryCreatorBrowsable` | flips `prospect` → `active` | for Discovery browse |

So there **is** an identity-promotion gate for pure `discovered_profiles`, but the dominant ingest paths **bypass** it and write the vendor master immediately. Promotion itself also marks rows `active`, so “in Vendors” ≠ “commercially onboarded.”

Unified browse (`inf:` / `dis:` ids) merges both worlds; default Discovery pool is influencers-first (`discovery-browse-pool.ts`).

Exploration detail: [Creator/vendor model explore](ea055d09-8b74-4431-ba25-4c3711ab601e).

### 1.3 Product reference alignment

`docs/THINKWAY_SYSTEM_REFERENCE.md` §7 Vendor master describes a **commercial** vendor master (rates, bank, status) — not a Discovery warehouse. `docs/ARCHITECTURE_ALIGNMENT.md` already maps Vendor master → `influencers` with UI label “Vendors”, while Discovery is a separate module. The bug is operational conflation + ingest bypass of the intended promote gate — not absence of a Discovery pool table.

### 1.4 Production evidence (2026-07-27)

| Signal | Count |
|---|---|
| `influencers` | 7,086 |
| Status = `active` | 7,085 |
| With `campaign_influencers` | 5 |
| With `vendor_ios` | 5 |
| With non-empty `payment_details` | 5 |
| Distinct `quotation_items.influencer_id` | 110 |
| Distinct shortlist `influencer_id` | 146 |
| `creator_dna` | 6,997 |
| `discovered_profiles` | 1,845 |

**Interpretation:** ~98%+ of Vendors list rows are Discovery inventory. Status `active` is not a commercial lifecycle signal.

---

## 2. Problems identified

1. **Wrong product boundary** — Ops/Finance CRM polluted by Discovery imports.  
2. **Two different “promote” concepts conflated** — identity promote (`discovered_profiles` → `influencers`) already exists; **commercial CRM activation** does not. Today identity promote ≈ “becomes a Vendor.”  
3. **Ingest bypass** — Import/Apify/URL-add skip `discovered_profiles` and write `influencers` as `active`.  
4. **Status enum overloaded** — `prospect|active|…`; browse eligibility forces `active`, so status ≠ CRM stage.  
5. **Dual Discovery stores** — `discovered_profiles` vs `influencers` confuse identity; DNA is influencer-keyed (`creator_dna` PK = influencer_id).  
6. **Scale/RLS cost** — listing all Discovery rows under commercial RLS caused Production timeouts (hotfix `475e657`).  
7. **Terminology drift** — “Vendor” vs “Influencer” vs “Creator” across UI/DB/docs.

---

## 3. Proposed architecture

### 3.1 Domains

```
┌─────────────────────────────────────────────────────────────┐
│                 Creator Identity (influencers)               │
│         platforms · DNA · handles · countries · search       │
└───────────────────────┬─────────────────────┬───────────────┘
                        │                     │
                        ▼                     ▼
            ┌───────────────────┐   ┌──────────────────────────┐
            │ Discovery surface │   │ Commercial CRM surface   │
            │ search/match/     │   │ lifecycle · completeness │
            │ shortlist/AI      │   │ legal · bank · VIO       │
            │ (full spine)      │   │ (activated subset only)  │
            └───────────────────┘   └──────────────────────────┘
```

### 3.2 Commercial profile (logical)

Either:

- **Preferred Phase 1:** columns on `influencers`  
  - `commercial_activated_at timestamptz null`  
  - `crm_status` enum null | incomplete | prospect | negotiating | active | preferred | inactive | do_not_use  
  - `crm_activated_by`, `crm_activated_reason` (assignment | quotation | vendor_io | manual | payment | …)  
  - `completeness_score numeric`, `completeness_missing jsonb` (generated/cached)

Or:

- **Optional Phase 1b:** table `creator_crm_profiles` 1:1 with `influencer_id` PK/FK — cleaner separation of columns, same soft-split semantics.

Recommendation: **1:1 side table** if commercial columns will grow (tax, agency, compliance); **columns on influencers** if we want minimal migration surface. Default pick: **side table** for clarity without splitting identity FKs.

### 3.3 Shared vs commercial-owned data

| Data | Owner |
|---|---|
| Display name, platforms, countries, DNA, avatars | Shared identity |
| Email/phone used for outreach | CRM (may copy from Discovery) |
| Rates / rate_card commercial | CRM |
| Legal, tax, bank, contracts, Vendor IO defaults | CRM |
| Campaign/assignment/VIO/payment history | Commercial facts (already FK’d) |

Avoid duplicating platform accounts.

---

## 4. Entity relationship model

```
influencers (identity)
  ├── 1:0..1 creator_crm_profiles (commercial lifecycle)
  ├── 1:N   influencer_platform_accounts
  ├── 1:N   creator_dna / enrichment artifacts
  ├── 1:N   discovery_shortlist_items (optional FK; no CRM activate)
  ├── 1:N   quotation_items
  ├── 1:N   campaign_influencers
  ├── 1:N   vendor_ios
  └── 1:N   deliverables / payments (as today)

discovered_profiles
  └── link/merge → influencers when unified (Discovery concern only)
```

**Invariant:** At most one commercial profile per `influencers.id`. Promote is idempotent.

---

## 5. Database changes (proposed)

### 5.1 New enum + table (sketch)

```sql
CREATE TYPE public.creator_crm_status AS ENUM (
  'incomplete', 'prospect', 'negotiating',
  'active', 'preferred', 'inactive', 'do_not_use'
);

CREATE TABLE public.creator_crm_profiles (
  influencer_id uuid PRIMARY KEY REFERENCES public.influencers(id) ON DELETE CASCADE,
  crm_status public.creator_crm_status NOT NULL DEFAULT 'incomplete',
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid REFERENCES public.profiles(id),
  activated_reason text NOT NULL,
  completeness_score numeric(5,2) NOT NULL DEFAULT 0,
  completeness_missing jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creator_crm_profiles_status_idx
  ON public.creator_crm_profiles (crm_status, activated_at DESC);
```

### 5.2 Service

`ensureCommercialCreator(influencerId, reason, actorId)` — insert profile if missing; never duplicate.

### 5.3 App query change

Creator CRM list: `influencers` **inner join** `creator_crm_profiles` (or `exists`).  
Discovery browse: unchanged full spine.

### 5.4 Partial indexes

```sql
-- optional hot path
CREATE INDEX influencers_crm_list_created_at_idx
  ON public.influencers (created_at DESC)
  WHERE EXISTS (/* or join key materialized */);
```

Prefer indexing `creator_crm_profiles(activated_at DESC)`.

---

## 6. Auto-create event matrix

| Event | Identity (`influencers`)? | Auto-create CRM profile? | Initial `crm_status` |
|---|---|---|---|
| Discovery import / Apify / URL-add | Today: creates influencer (keep for browse/DNA; **do not** CRM-activate) | **No** | — |
| Pure `discovered_profiles` shortlist add | Optional / none | **No** | — |
| `promoteDiscoveredProfileToInfluencer` (assignability) | **Yes** (existing) | **No** by itself | — |
| Shortlist → Campaign assignment | Promote identity if needed | **Yes** | incomplete |
| Quotation → Campaign / quotation item commercialized | Identity as today | **Yes** | incomplete |
| Create campaign assignment | Requires influencer_id | **Yes** | incomplete |
| Generate Vendor IO | Already has influencer | **Yes** (idempotent) | incomplete → optional `active` |
| Save bank / contract / payment terms | — | **Yes** | incomplete |
| Manual “Convert to Commercial Creator” | May create identity if missing | **Yes** | incomplete |
| Manual “Create Commercial Creator” | New identity + CRM | **Yes** | incomplete |

**Rationale:** Keep identity promote for assignability. **CRM activation is a second, stricter gate** at quotation/assignment/VIO/manual convert — not at import or shortlist-only.

---

## 7. Status lifecycle

```
(null = Discovery-only)
        │ promote
        ▼
   incomplete ──► prospect ──► negotiating ──► active ──► preferred
                      │              │            │
                      └──────────────┴────────────┴──► inactive
                                                      do_not_use (compliance)
```

### Improvements vs original chain

- Explicit **null** Discovery-only state (not a CRM status).  
- **incomplete** is onboarding, not “prospect”.  
- **do_not_use** replaces overloaded blacklist for commercial.  
- Keep `influencers.status` for legacy/archive flags during transition; deprecate for CRM UI once `crm_status` lands.

### Optional upgrade rules

- First paid Vendor IO / payment recorded → suggest `active`.  
- N successful campaigns → suggest `preferred` (manual confirm).

---

## 8. Completeness engine

### Dimensions (weights illustrative)

| Dimension | Weight | Examples |
|---|---|---|
| Identity | 15 | legal name, country |
| Platforms | 10 | ≥1 primary account |
| Contact | 15 | email or phone |
| Agency | 5 | management_agency / agency link |
| Rates | 10 | rate_card |
| Legal | 10 | tax id / nationality as required by market |
| Tax | 10 | VAT / WHT fields |
| Bank | 15 | payment_details |
| Contracts | 5 | influencer_documents |
| Vendor IO defaults | 5 | vendor_io_terms_text |

### Outputs

- `completeness_score` 0–100  
- `completeness_missing[]` for checklist UI  
- Gates: e.g. cannot **Send Vendor IO** without Bank + Contact; cannot mark `active` without Contact + Platforms

---

## 9. Migration strategy

### 9.1 Rules (backfill)

Activate CRM if **any**:

- row in `campaign_influencers`  
- row in `vendor_ios`  
- non-empty commercial `payment_details`  
- row in `quotation_items` with `influencer_id`  
- commercial contract document type (if classifiable)  
- explicit future “commercial activity” audit events  

**Do not** activate for shortlist-only or import-only.

### 9.2 Status assignment on backfill

| Condition | crm_status |
|---|---|
| Has VIO or payment_details | `active` |
| Has assignment or quotation only | `incomplete` |
| Else | not activated |

### 9.3 Safety

- Dry-run report: counts + sample IDs  
- Additive only — **no deletes** of Discovery/`influencers`  
- Feature flag: `CREATOR_CRM_FILTER_ENABLED`  
- Rollback: drop filter / truncate `creator_crm_profiles` (identity intact)

### 9.4 Expected Prod shape after migration

- CRM list ≈ union(quotation ≈110, assignment/VIO/payment ≈5) → **on the order of ~110–120**  
- Discovery remains ~7k  

---

## 10. Rollout strategy

| Phase | Work | Exit criteria |
|---|---|---|
| 0 | Approve this proposal | Written Go |
| 1 | Schema + `ensureCommercialCreator` + tests | Idempotent promote |
| 2 | Creator CRM UI filter + rename/nav | List shows activated only |
| 3 | Wire auto-promote on quotation/assignment/VIO/manual | New deals create Incomplete |
| 4 | Backfill migration (dry-run → Prod) | Report signed off |
| 5 | Completeness + status UX + gates | Ops can complete profiles |
| 6 (optional) | Deprecate legacy `influencers.status` in CRM UI | Single lifecycle |

Deploy app filter **after** backfill (or with flag) so CRM is never empty by accident mid-cutover.

---

## 11. UI / UX proposal

### Naming

| Surface | Label |
|---|---|
| Nav module | **Creator CRM** |
| Entity | **Commercial Creator** |
| Discovery entity | **Creator** / Discovery Creator |
| DB | keep `influencers` |

Avoid “Commercial Creators” as nav (awkward). Avoid keeping “Vendors” once CRM filter lands (finance still says “vendor payment” on IO/invoice — fine).

### Discovery actions

1. Add to Shortlist — Discovery only  
2. Add to Campaign / Quotation — promote + link  
3. Convert to Commercial Creator — explicit promote  
4. Open Commercial Profile — if activated  

### Campaign picker

Prefer CRM results; allow “Search Discovery” with confirm → promote.

### Workspace

Creator CRM detail keeps operational tabs (Overview, Legal, Finance, Documents, Platforms, Campaigns) + Completeness strip + CRM status.

---

## 12. Campaign workflow

```
Discovery Creator
   │ add to quotation OR assign to campaign
   ▼
ensureCommercialCreator(incomplete)
   │
   ▼
Campaign / Quotation / Assignment references influencers.id
   │ Vendor IO
   ▼
CRM status may advance to active (rule-based or manual)
```

**Duplicates:** forbidden at identity level (same `influencers.id`). Platform-account match should resolve to existing identity before create.

---

## 13. Search

| Surface | Corpus |
|---|---|
| Discovery Search | Full spine + DNA |
| Creator CRM Search | Activated CRM only |
| Campaign assignment picker | CRM-first + Discovery overflow with promote |
| Global search | Tabbed: Discovery \| Creator CRM \| Campaigns |

Keep indexes separate logically even if same table (filtered queries / RPC).

---

## 14. Backward compatibility

| Area | Impact |
|---|---|
| Campaigns / assignments | None on FKs; promote on write |
| Vendor IO / invoices / payments | Unchanged FKs |
| Quotations | Promote on item add |
| Shortlists | No promote |
| Discovery browse | Unchanged |
| Reporting | Add CRM filter dimension |
| Existing `/vendors/INF-*` URLs | Redirect/alias to Creator CRM routes |

---

## 15. Performance

| Scale | Approach |
|---|---|
| 10K identity / ~100 CRM | Soft split + CRM join sufficient |
| 100K identity | Discovery keeps ID-stage browse RPCs; CRM stays small |
| 1M identity | Do **not** list full spine in CRM; consider hard split only if CRM also grows huge |

Reuse lessons from Vendors RLS timeout: never exact-count the full spine for CRM; count `creator_crm_profiles`.

---

## 16. Security

- Reuse `influencers.read` / `influencers.write` for CRM.  
- Promote requires `influencers.write` **or** `campaigns.write` / quotation write (decide matrix).  
- Bank/legal tabs: keep finance-sensitive permissions.  
- RLS stays on `influencers`; CRM visibility is **application filter + optional policy** helper `can_read_creator_crm` if we later hide commercial columns from Discovery-only roles.  
- Do **not** restore `USING (true)` allow-all policies.

---

## 17. Risks

| Risk | Mitigation |
|---|---|
| Ops expects old Vendors = all Discovery | Training + Convert action + docs |
| Quotation creators flood Incomplete | Intended; completeness drives quality |
| Missed promote on some write path | Central `ensureCommercialCreator` only |
| Empty CRM if filter ships before backfill | Ordered rollout + feature flag |
| Hard-split later temptation | Only if metrics demand |

---

## 18. Alternatives (summary)

| Option | Verdict |
|---|---|
| **A. Soft split + CRM profile** | **Recommended** |
| B. Hard split `commercial_creators` table rewriting FKs | Phase 3+ only |
| C. Move Discovery entirely to `discovered_profiles` | Rejected near-term (rewrite DNA/import) |
| D. View filter without lifecycle | Rejected (no Incomplete/completeness) |

---

## 19. Pros / cons of recommendation

**Pros**

- Preserves Production FKs and INF numbers  
- Clears CRM to ~commercial set quickly  
- Enables Incomplete onboarding + completeness  
- Aligns with system reference Vendor master intent  
- Improves list performance by shrinking CRM corpus  

**Cons**

- Identity table remains large (Discovery still on spine)  
- Requires discipline: every commercial write path must call ensure  
- Naming migration (Vendors → Creator CRM) needs UX care  

---

## 20. Open questions for approval

1. Confirm **quotation** auto-promotes (recommended Yes).  
2. Confirm **shortlist alone** does not (recommended No).  
3. Side table `creator_crm_profiles` vs columns on `influencers`? (recommended side table).  
4. Route: `/creators` new vs `/vendors` rename in place?  
5. Should first Vendor IO auto-advance Incomplete → Active?  
6. Permission: who may Convert (AM vs Admin only)?  

---

## 21. Approval gate

Implementation starts only after explicit approval of:

- Soft-split architecture  
- Event matrix  
- Migration rules  
- Naming (Creator CRM)  
- Phased rollout order  

**No code for this feature has been started in this design pass.**
