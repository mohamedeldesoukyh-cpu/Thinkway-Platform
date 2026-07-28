# Release 2.0 — Complete Impact Analysis

**Status:** Approved baseline for Phase 1 (2026-07-28)  
**Parent:** [RELEASE_2_0_ARCHITECTURE.md](./RELEASE_2_0_ARCHITECTURE.md)  
**Normative:** [DECISIONS.md](./DECISIONS.md) · [FIELD_OWNERSHIP_MATRIX.md](./FIELD_OWNERSHIP_MATRIX.md)  
**Date:** 2026-07-28

Impact legend:

| Level | Meaning |
|---|---|
| **None** | No change expected |
| **Low** | Docs / labels / read paths / optional columns |
| **Medium** | Behavior change with compatibility shims |
| **High** | Core write-path or schema change; needs migration tests |
| **Critical** | Financial or lifecycle integrity risk if wrong |

---

## 1. Summary matrix

| Domain | Impact | Phase 1? | Notes |
|---|---|---|---|
| Database / migrations | **High** | Yes | Provenance + snapshot tables/columns |
| Quotation convert (backend) | **Critical** | Yes | Replace Path A; unify with Path B core |
| Quotation UI | **Medium** | Yes | CTA, idempotency, preview |
| Campaign workspace / Assignments UI | **Medium** | Yes | Empty-state backfill CTA; accepted quote chip |
| Campaign Plan generate | **Medium** | Yes | Shared pipeline + quote FK fix |
| Shortlist ↔ quote sync | **Low** | No behavior change | Remains pre-convert only |
| Media Planning engine | **Medium** | Partial | Ownership rules; hard guards Phase 1.5 |
| Performance / publications | **Low** | No | Already feeds Actual |
| Vendor IO | **Low–Medium** | Compat | Needs lines; benefits from convert fix |
| Billing / invoices | **Low** | Compat | Still line/deliverable/post; no quote FK |
| Vendor payments / CRM | **Low** | Yes | Keep dual-event on convert |
| Reporting | **Medium** | Later | Prefer Assignment + accepted quote pin |
| AI / Studio / Copilot | **Medium** | Partial | Prefer Assignment seed post-convert |
| APIs / exports | **Low–Medium** | Yes | Quotation export unchanged; campaign APIs gain provenance |
| Workflows / approvals | **Low** | No | Quote approvals stay on quote; plan portal unchanged |
| RLS / authz | **Medium** | Yes | Snapshot table policies |
| Tests / CI | **High** | Yes | Convert + idempotency + billing smoke |

---

## 2. Frontend

### 2.1 Quotation workspace

| Asset | Impact | Change |
|---|---|---|
| `quotation-lifecycle-sheet.tsx` | High | “Create campaign” → Convert to Assignments; show projection preview; block if exists |
| `quotation-lifecycle-panel.tsx` | Medium | Align or delete unused panel |
| `quotation-lifecycle-pills.tsx` | Low | Show accepted pin / Assignment count |
| Creators / deliverables UI | None | Remains commercial editor |
| Preview / PDF export | None | Still quote document |

### 2.2 Campaign workspace

| Asset | Impact | Change |
|---|---|---|
| Assignments tab (`campaign-lines-tab-*`) | Medium | CTA when `quotation_id` set and zero lines: “Create Assignments from Quotation” |
| Header / KPI strip | Low | Accepted quote chip (serial + version) |
| Deliverables tab | Low | Benefits when convert expands hierarchy |
| Workflow tab | None | — |
| Media Plan load (`load-campaign-media-plan.ts`) | Medium | Prefer Assignment seed; respect Original/Current/Actual ownership |

### 2.3 Campaign Plan / Studio

| Asset | Impact | Change |
|---|---|---|
| `generate-campaign-entry.tsx` / launcher | Medium | Copy: creates Assignments; quotation stays baseline |
| Studio hydration / `seedFromQuotation` | Medium | Post-convert prefer `seed-from-assignment-hierarchy` |
| Copilot / output center | Low | Context includes Assignment IDs when present |
| Campaign Plan → Quotation generate | None | Upstream unchanged |

### 2.4 Billing / IO / Vendors UI

| Asset | Impact | Change |
|---|---|---|
| Generate Vendor IO | Low | Works once lines exist (unblocks quote-originated campaigns) |
| Invoice queue / selection | None | Still Assignment hierarchy selection |
| Vendors CRM tabs | Low | Activation events unchanged in shape |

### 2.5 Client Portal

| Asset | Impact | Change |
|---|---|---|
| Quotation portal | None | — |
| Media Plan portal Original | Low | Still baseline; R2 Actual portal remains separate approval |

---

## 3. Backend / services

| Service | Impact | Change |
|---|---|---|
| `quotation-lifecycle-service.createCampaignFromQuotation` | **Critical** | Replace with unified convert |
| `generate-campaign-from-campaign-plan.ts` | High | Shared seed/convert; set quote FKs |
| `quotation-execution-mapper.ts` | Medium | Extend for AF, descriptions, free_for_client, provenance |
| `campaign-line-service.createCampaignLine` | Medium | Accept source_quotation_* ; preserve behavior |
| `quotation-version-service` | Low | Keep V2 copy of campaign link; no auto Apply |
| Commercial sync engine | None | Still gated by quote status |
| Billing `invoice-service` | None | No quote references |
| `generate-vendor-io-action` | Low | More eligible lines after convert |
| CRM `ensureCommercialCreatorFromQuoteToCampaign` | Low | Keep on convert |
| Media Plan mutations / engine | Medium | Non-live guards (Phase 1.5) |
| Performance facts | Low | Already Actual input |

---

## 4. Database

### 4.1 Proposed schema (Dev migrations first)

| Change | Type | Compat |
|---|---|---|
| `campaign_headers.accepted_quotation_id` uuid null FK | Add | Nullable |
| `campaign_headers.accepted_quotation_version` int/text null | Add | Nullable |
| `campaign_lines.source_quotation_id` uuid null | Add | Nullable |
| `campaign_lines.source_quotation_item_id` uuid null | Add | Nullable |
| `campaign_commercial_snapshots` table | Add | New; RLS like campaign |
| Optional: `assignment_deliverables.service_description`, `free_for_client` | Add | Nullable |
| Indexes on provenance FKs | Add | — |

### 4.2 Explicit non-changes

- No `assignments` table  
- No `quotation_id` on `invoices`  
- No drop of `campaign_headers.quotation_id` (legacy convenience)  
- No forced delete of Path A orphan `campaign_influencers` without lines  

### 4.3 Environments

| Env | Action |
|---|---|
| Development `hsxrewjcbvmbkqdlzjhs` | First migrate + validate |
| Production `ienowhwfyxoqtzbgltno` | Only after explicit approval |

---

## 5. Workflows & approvals

| Workflow | Impact | Notes |
|---|---|---|
| Quotation status machine | Low | May allow convert from `accepted` (D1) |
| Quotation client portal approval | None | Remains quote-side |
| Campaign header status | Low | Convert sets `draft` |
| Media Plan portal approve/reject | Low | Ownership docs; guard wiring later |
| `approvals` / `approval_steps` tables | None | No redesign |
| 15-stage campaign lifecycle (reference) | None | Still not fully implemented; out of Phase 1 |

---

## 6. AI services

| Component | Impact | Change |
|---|---|---|
| Quotation AI workspace | None | — |
| Campaign Studio copilot | Medium | Prefer Assignment hierarchy in tools/context after convert |
| Campaign Plan / Director / Facts | Low | Plan generate uses shared convert |
| Output generators (media_plan, etc.) | Low | Consume plan; must not invent commercial SSOT |
| Discovery progressive search | None | — |

Risk: Copilot regenerating slate commercials from quote after Assignments exist → **guard**: if Assignments present, commercial reads come from lines/snapshot.

---

## 7. Reports

| Report / export | Impact | Change |
|---|---|---|
| Quotation PDF/Excel | None | — |
| Shortlist showcase PDF | None | — |
| Vendor IO PDF | Low | More complete when lines exist |
| Invoice documents | None | Still campaign PO display |
| Campaign / finance reports | Medium | Join `accepted_quotation_*` for audit columns; amounts from lines |
| Media Plan exports | Low | Original vs Actual labeling |

---

## 8. Billing

| Topic | Impact | Assessment |
|---|---|---|
| Invoice create eligibility | Positive | Convert creates lines → VIO → invoice path unblocked |
| Invoice FKs | None | Keep line/deliverable/post |
| Amounts source | None | Assignment hierarchy remains commercial ops SSOT |
| Quote revision after invoice | Controlled | Apply revision must skip locked lines |
| VAT / tax | Low | Still line fields; quote has no tax model |

**Critical invariant:** Billing never reads live `quotation_items` for amounts.

---

## 9. Media Planning

| Topic | Impact | Phase |
|---|---|---|
| Engine module structure | Low | Keep `lib/media-plan` |
| Original immutability | Medium | Enforce/document (mostly v1 true) |
| Current non-live edit guard | High (behavior) | Phase 1.5 |
| Actual from Performance | Low | Already true |
| Seed from Assignments | Medium | Phase 1 (align hotfix on develop) |
| Slate vs Assignment budget banner | Low | Phase 1 UX |
| Portal Actual | Out of scope | Separate approval |

---

## 10. Performance

| Topic | Impact | Notes |
|---|---|---|
| `campaign_publications` | None | — |
| Live dates on posts | None | Continue to feed Actual |
| Metrics collection | None | — |
| Assignment hierarchy sanitize | Low | More complete trees after convert |

---

## 11. Vendor IO

| Topic | Impact | Notes |
|---|---|---|
| `vendor_ios.assignment_id` | None | Still `campaign_influencers.id` |
| `vendor_io_lines.campaign_line_id` | Positive | Lines exist after convert |
| Terms compose from CRM | None | — |
| Path A campaigns today | High pain → fixed | No lines ⇒ cannot VIO properly |

---

## 12. Commercial CRM

| Topic | Impact | Notes |
|---|---|---|
| Activation on convert | Keep | Dual-event helper |
| Payment readiness | None | Still blocks payout, not convert |
| Rate history from packages | Medium | Phase 1.5+ optional |
| Relationship records | Low | Last engagement metadata later |

---

## 13. APIs

| API / action | Impact | Change |
|---|---|---|
| Server actions `createCampaignFromQuotation` | High | New semantics (Assignments) |
| `generateCampaignFromPlanAction` | Medium | Shared pipeline |
| Quotation export route | None | — |
| Shortlist export | None | — |
| REST public APIs | Audit | Grep for campaign create; update contracts/docs |
| Webhooks | None known | Confirm in implementation |

---

## 14. Cross-cutting concerns

| Concern | Impact |
|---|---|
| RLS | Snapshot + new columns need policies matching `campaign_headers` tenancy |
| Audit logs | New event names: `quotation.converted_to_assignments`, snapshot written |
| Permissions | Keep discovery write + campaigns.write for convert |
| Performance | Convert is batch line creates — guard timeouts for large quotes |
| i18n / copy | User-facing verb change: Convert / Create Assignments |
| Feature flags | Recommend `release_2_0_assignment_convert` for staged rollout |

---

## 15. What breaks if we do nothing

1. Quote-originated campaigns remain **non-billable** without manual Assignment creation.  
2. Dual Path A/B continues to confuse ops and under-copy commercials.  
3. Quote V2 drift has no enterprise Apply path.  
4. Media Plan / Performance enrichment has weak IDs when only vendor links exist.  
5. Production go-live risk for commercial lifecycle completeness.

---

## 16. Owner sign-off (fill on approval)

| Domain | Owner | Reviewed | Notes |
|---|---|---|---|
| Architecture | | ☐ | |
| Billing / VIO | | ☐ | |
| Media Planning | | ☐ | |
| CRM / Payments | | ☐ | |
| AI / Studio | | ☐ | |
| Database / RLS | | ☐ | |
| Product | | ☐ | |
