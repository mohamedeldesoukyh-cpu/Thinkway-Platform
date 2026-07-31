# Release 2.2 — Production Review Package

**Status:** ✅ **Production Review Approved** · 🚀 **Production deployment authorized** (2026-07-31)  
**Feature Freeze:** ✅ Approved 2026-07-31 (Product)  
**Interactive UAT:** ✅ Approved 2026-07-31  
**Production Approval:** ✅ Authorized 2026-07-31 — sequence: migrations → deploy → OPS-EMAIL → smoke → closure  
**Production deploy:** ⏳ In progress / pending execution evidence  
**Release tip (develop):** `09f9b741` (+ docs commit)  
**Preview:** `https://dev.thinkwaymedia.com` · Dev Supabase `hsxrewjcbvmbkqdlzjhs`  
**Production target:** `https://app.thinkwaymedia.com` · Supabase `ienowhwfyxoqtzbgltno`  
**Parent architecture:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md)  
**UAT:** [`RELEASE_2_2_UAT.md`](./RELEASE_2_2_UAT.md)  
**Implementation:** [`RELEASE_2_2_IMPLEMENTATION.md`](./RELEASE_2_2_IMPLEMENTATION.md)  
**Architecture Validation:** [`RELEASE_2_2_ARCHITECTURE_VALIDATION.md`](./RELEASE_2_2_ARCHITECTURE_VALIDATION.md)  
**Implementation Validation:** [`RELEASE_2_2_IMPLEMENTATION_VALIDATION.md`](./RELEASE_2_2_IMPLEMENTATION_VALIDATION.md)

---

## 1. Release summary

**Release 2.2 — Client IO Enterprise Completion** elevates Client IO into the Ops↔Finance commercial contract without inventing a second ledger.

| Deliverable | Outcome |
|---|---|
| Assignment-selected composer | Shipped — select `campaign_lines.id[]` before generate |
| Frozen Assignment snapshot at issue | Shipped — historical docs immutable (`assignment_snapshot`) |
| Append-only amendments (`/A1`…`/An`) | Shipped — UAT Original→A3; single tip; priors superseded |
| Configurable billing milestones | Shipped — templates + custom; schedule ownership only (no invoice execution) |
| Lifecycle `under_client_review` | Shipped — send stamps review tip status + dual Timeline events |
| Enterprise Timeline CIO events | Shipped — generate / sent / under_client_review / approved / amend / supersede |
| Finance lock via CIO existence | Preserved |

**Out of scope (untouched / deferred):**

| Item | Status |
|---|---|
| Invoice eligibility / billing execution against milestones | Release **2.3** |
| Planning Board (2.2a) / Copilot (2.2b) | Queued after this Feature Freeze |
| Commercial Revision OS | Release **3.0** |
| Convert auto-create CIO | Still **never** |
| VIO / Payments / Credit Notes redesign | Untouched |
| Media Plan / Assignments / Deliverables core | Untouched (regression Pass) |

**Database:** Three Development-validated migrations **must** be applied to Production before or with deploy (see §7).

---

## 2. Commit list (release tip on `develop`)

| SHA | Type | Summary |
|---|---|---|
| `d6c983fe` | feat | Client IO enterprise completion for Preview (composer, amendments, milestones, Timeline) |
| `298add93` | docs | Record Preview tip SHA after develop push |
| `f631a954` | docs | Mark Interactive UAT as active Preview gate |
| `09f9b741` | fix | Unnest Client IO forms so milestones and amendments submit (DEF-R22-01 / DEF-R22-02) |

**Supporting docs (pre-feature tip):** `564e116e` implementation package · Architecture Validation approved separately.

**Release tip for Production (when approved):** merge `develop` containing the commits above (plus this Production Review docs commit) → `main` → approved Production deploy + Production migrations per [`RELEASE_WORKFLOW.md`](../RELEASE_WORKFLOW.md).

**Proposed tag:** `v2.2.0` (after Production Complete).

---

## 3. UAT evidence

| Scenario | Result |
|---|---|
| P1 – Client IO Lifecycle | ✅ PASS |
| P2 – Amendment Chain | ✅ PASS (Original → A1 → A2 → A3) |
| P3 – Billing Milestones | ✅ PASS |
| P4 – Assignment / Snapshot Integrity | ✅ PASS |
| P5 – Regression | ✅ PASS |
| Critical / High product defects open | ✅ None |
| Medium product defects open | ✅ None blocking (DEF-R22-03 accepted as INFRA) |

**Fixture:** Campaign `TW-2026-0002` · tip `CIO-2026-0002/A3` on Preview  
**Dev Supabase:** `hsxrewjcbvmbkqdlzjhs`  
**Automated (final):** `npm run test:release-2-2` — **17/17**

Full evidence: [`RELEASE_2_2_UAT.md`](./RELEASE_2_2_UAT.md).

### Architectural highlights (UAT)

- Original snapshot hash `ecfef70e…` unchanged through amendment supersession  
- Distinct immutable snapshots per amendment revision  
- Single active tip; priors `is_superseded=true`  
- Timeline dual events on send: `client_io.sent` + `client_io.under_client_review` (intentional contract)

---

## 4. Defect register (final dispositions)

| ID | Severity | Status | Disposition |
|---|---|---|---|
| DEF-R22-01 | High | **Fixed** (`09f9b741`) | Nested forms blocked Save milestones / Create amendment — Fixed + retested — **Accepted** |
| DEF-R22-02 | Medium | **Fixed** (`09f9b741`) | Header Regenerate stayed enabled post-send — Fixed — **Accepted** |
| DEF-R22-03 | Medium | **Open (accepted)** | Preview Gmail/SMTP env missing — lifecycle OK — **Accepted as infrastructure**; **must verify on Production** (§8 OPS-EMAIL) |
| DEF-R22-04 | Low | **Open (accepted)** | Generate needs hard refresh after Save selection — **Accepted for UX backlog** |

---

## 5. Known limitations

| ID | Type | Notes |
|---|---|---|
| DEF-R22-03 / OPS-EMAIL | Infrastructure | Preview email delivery failed; Production email path **must** be verified before declaring release closed |
| DEF-R22-04 | UX backlog | Soft revalidate after Save selection — non-blocking |
| SCOPE-01 | Deferred | Milestone → invoice eligibility is **2.3** — schedule config only in 2.2 |
| SCOPE-02 | Deferred | Cancel dedicated Timeline emitter polish (R-T2) — cancel path partially audited |
| SCOPE-03 | Deferred | 2.2a Planning Board / 2.2b Copilot frozen until after this release |
| UAT-01 | Checklist | Some secondary functional boxes (C4 empty-selection UI, C5 all layouts, R1 Convert, R5 register) not fully re-exercised interactively — core P1–P5 covered |

---

## 6. Rollback plan

| Layer | Action |
|---|---|
| Code | Revert Production deploy to prior `main` tip (pre-R2.2 / post-`v2.1.0`) |
| Schema | Migrations are **additive** (junction tables, columns, enum value, milestones table, amendment columns). Do **not** DROP in panic; prefer code rollback first. If schema rollback is ever required, use a dedicated reverse migration after explicit approval — never ad-hoc Production DDL |
| Documents | Existing CIO tips remain; older app versions may not show amendment UI — tip resolution must remain safe |
| Snapshots | Additive `assignment_snapshot` — older readers ignore |
| Timeline metadata | Additive CIO event names — UI falls back gracefully |
| Commercial / Media Plan / VIO / Billing execution | Untouched by R2.2 feature surface — no rollback surface there |

**Never** rewrite historical `assignment_snapshot` rows as part of rollback.

---

## 7. Production deployment checklist

**Do not execute until explicit Production Approval.**

| # | Step | Done |
|---|---|---|
| 1 | Confirm Feature Freeze still in force (no unapproved functional commits on tip) | ☐ |
| 2 | Confirm Production target Supabase `ienowhwfyxoqtzbgltno` (never Dev `hsxrewjcbvmbkqdlzjhs`) | ☐ |
| 3 | Apply Production migrations (Dev-validated first): `20260731120000_release_2_2_client_io_composer.sql`, `20260731130000_release_2_2_client_io_amendments.sql`, `20260731140000_release_2_2_client_io_milestones_workflow.sql` | ☐ |
| 4 | Verify Migration status on Production (tables/columns/enum present; no drift) | ☐ |
| 5 | Merge approved tip `develop` → `main` (or approved PR) | ☐ |
| 6 | Production deploy only after written approval (`[deploy-production]` or approved `vercel deploy --prod`) | ☐ |
| 7 | Ops Center Production: environment = Production, Supabase aligned, git SHA matches release tip | ☐ |
| 8 | **OPS-EMAIL:** Verify Gmail/SMTP credentials on Production (§8) | ☐ |
| 9 | Run Production smoke checklist (§9) | ☐ |
| 10 | Tag `v2.2.0` + record release notes + Ops evidence | ☐ |

---

## 8. Operational checklist — email delivery (DEF-R22-03)

> Product disposition: accepted on Preview as env/infra. **Production must prove delivery** before Release Closure.

| # | Check | Expect | Done |
|---|---|---|---|
| E1 | Production env has Gmail OAuth / SMTP secrets (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` or current production mail stack) | Present + non-stale | ☐ |
| E2 | Send Client IO from a Production (or Production-like) tip to a controlled recipient | `delivery_status` success (or provider-accepted) | ☐ |
| E3 | Email template renders (branding, amounts, campaign identity) | Readable; no broken placeholders | ☐ |
| E4 | Approval link / token URL works on Production host | Opens `/io-approval/client` (or current path); approves **current tip** | ☐ |
| E5 | Tip status after send | `under_client_review`; `sent_at` set | ☐ |
| E6 | Enterprise Timeline | Both `client_io.sent` and `client_io.under_client_review` visible | ☐ |
| E7 | `io_notifications` row | Present for send attempt with accurate delivery metadata | ☐ |

If E2 fails on Production, **stop Release Closure** and treat as release-critical ops fix (not a Feature Freeze reopen for product scope).

---

## 9. Production smoke test checklist

| # | Smoke | Expect |
|---|---|---|
| S1 | Open Campaign → Client IO on an Assignment-backed campaign | Tip loads; composer / history chrome present |
| S2 | Ensure / load CIO tip | No crash; Convert still does **not** auto-create CIO |
| S3 | Select Assignments → Generate (draft/safe fixture) | Document includes only selected lines; snapshot frozen |
| S4 | Billing milestones on draft tip | Template save; totals ≠ 100% rejected |
| S5 | Send → Under Client Review | Status + Timeline dual events (and email per §8) |
| S6 | Token/portal Approve | Tip → `approved`; Timeline `client_io.approved` |
| S7 | Create amendment (if fixture allows) | Prior superseded; new `/A{n}` tip; prior snap unchanged |
| S8 | Re-open prior CIO version / document | Historical content unchanged (snapshot integrity) |
| S9 | Media Plan / Assignments / Deliverables tabs | No regression |
| S10 | Finance lock | Commercial amount edit blocked while CIO exists (expected) |
| S11 | Ops Center | Production ↔ `ienowhwfyxoqtzbgltno`; build SHA = release tip |

---

## 10. Release notes (draft)

### Thinkway Release 2.2 — Client IO Enterprise Completion

**What changed**

- Client IO composition is Assignment-selected: documents and commercial rollups include only chosen Assignments.
- Issued Client IOs freeze an Assignment snapshot so later Media Plan / Assignment edits do not rewrite history.
- Amendments are append-only (`CIO-YYYY-NNNN/A1` …): prior versions are immutable; only one active tip exists.
- Configurable billing milestones (100%, 50/50, monthly, custom) are owned on the Client IO tip and rendered on the document. Invoice execution against milestones remains Release 2.3.
- Send moves the tip to **Under Client Review** and records both `client_io.sent` and `client_io.under_client_review` on the Enterprise Timeline.
- Token/portal approval continues to approve the **current tip** only.

**What did not change**

- Convert still does not auto-create Client IO.
- Media Plan, Assignments, Deliverables, Vendor IO, invoice posting, and payments execution paths are not redesigned.
- Planning Board / Copilot remain queued (2.2a / 2.2b).

**Ops notes**

- Requires three Production migrations (composer, amendments, milestones/workflow).
- Verify Production email delivery (Preview UAT accepted email failure as infrastructure).
- Automated suite: `npm run test:release-2-2` (17 tests).

---

## 11. Production readiness assessment

| Criterion | Assessment |
|---|---|
| Architecture frozen & followed | ✅ |
| Implementation complete | ✅ |
| Architecture / Implementation Validation | ✅ |
| Automated tests green | ✅ 17/17 |
| Preview + Interactive UAT | ✅ Approved |
| Feature Freeze | ✅ Approved 2026-07-31 |
| Open Critical/High product defects | ✅ None |
| Medium defects | ✅ Fixed or accepted (DEF-R22-03 → OPS-EMAIL) |
| Schema / migration risk | ⚠ **Three additive migrations required on Production** |
| Commercial / Finance blast radius | ✅ Controlled (CIO contract + lock; no invoice engine) |
| Explicit Production Approval | ⛔ **Required before deploy** |

**Recommendation:** **Ready for Production Approval review.** Do not deploy, merge to `main`, or apply Production migrations until Product authorizes Production.

---

## Governance

| Stage | Status |
|---|---|
| Architecture | ✅ Complete |
| Development | ✅ Complete |
| Architecture Validation | ✅ Approved |
| Implementation Validation | ✅ Complete |
| Preview | ✅ Live |
| Interactive UAT | ✅ Approved |
| Feature Freeze | ✅ Approved |
| Production Review Package | ✅ Approved |
| Production Approval | ✅ Authorized 2026-07-31 |
| Production Deployment | ⏳ Contingent on migrations → deploy → OPS-EMAIL → smoke |
| Production Smoke | ⏳ Pending post-deploy |
| Release Closure | ⛔ Only after post-deploy checks pass |

**Merge policy after Feature Freeze:** No further functional enhancements into Release 2.2. Only release-critical deployment fixes arising during Production Review may be considered.
