# UAT Checklist — Thinkway Production Go-Live

**Purpose:** Structured pass/fail validation before production release.  
**Environment:** Staging or production-like Supabase + Vercel preview/production.  
**Testers:** Assign roles per section (Account Manager, Finance, Operations, Viewer, Admin).

**Legend:** ☐ Pass · ☐ Fail · ☐ N/A · ☐ Blocked

Record: Tester name · Date · Environment URL · Build SHA (`/api/build-info`)

---

## 0. Pre-flight

| # | Test | Steps | Expected | Pass |
|---|------|-------|----------|:----:|
| 0.1 | Build verification | Open `/api/build-info` | `supabaseAligned: true`, `legacyAssignmentsEnvPresent: false`, git SHA current | ☐ |
| 0.2 | Admin login | Sign in as super_admin | Dashboard loads | ☐ |
| 0.3 | Role test users | Confirm finance, account_manager, operations, viewer accounts exist | Each can log in | ☐ |
| 0.4 | Migration parity | `npx supabase migration list` | All migrations applied remote | ☐ |

---

## 1. Clients (legal entities)

### 1.1 Create client

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 1.1.1 | Create new client | Account Manager | `/clients` → New client → fill required fields → save | Client created; visible in list | ☐ |
| 1.1.2 | Duplicate name blocked | Account Manager | Create client with same name + agency/direct as existing | Validation error | ☐ |
| 1.1.3 | Viewer cannot create | Viewer | Attempt create via UI | Denied or no write UI | ☐ |
| 1.1.4 | Finance cannot create | Finance | Attempt create | RLS/action denial | ☐ |

### 1.2 Edit client

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 1.2.1 | Edit overview | Account Manager | Open client workspace → Overview → edit name/notes | Saves successfully | ☐ |
| 1.2.2 | Edit legal tab | Account Manager | Legal tab → update trade name | Persists after refresh | ☐ |
| 1.2.3 | Edit finance tab | Finance | Finance tab → payment terms | Saves; AM may be read-only | ☐ |
| 1.2.4 | Credit limit | Finance / Admin | Update credit limit controls | Enforced per migration | ☐ |

### 1.3 Classification

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 1.3.1 | Auto-classification | Account Manager | Create client → accept/override category suggestion | Category stored; audit trail | ☐ |
| 1.3.2 | Manual category | Account Manager | Set category manually | `category_manually_set` reflected | ☐ |
| 1.3.3 | Classification review | Admin | Review queue if enabled | Approve/reject works | ☐ |

### 1.4 Client documents

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 1.4.1 | Upload PDF | Account Manager | Documents tab → upload PDF <50MB | File stored; appears in list | ☐ |
| 1.4.2 | Reject oversized file | Account Manager | Upload >50MB | Error message | ☐ |
| 1.4.3 | Reject bad MIME | Account Manager | Upload disallowed type | Error message | ☐ |
| 1.4.4 | Download via signed URL | Account Manager | Download document | File opens; link expires | ☐ |

---

## 2. Campaigns

### 2.1 Create campaign

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 2.1.1 | Brand-first create | Account Manager | New campaign → select brand | Group, legal entity, VR%, currency auto-fill | ☐ |
| 2.1.2 | Campaign numbering | Account Manager | Save campaign | Header `TW-YYYY-NNNN` assigned | ☐ |
| 2.1.3 | Empty assignments | Account Manager | Open new campaign Assignments tab | No bootstrap lines; empty CTA | ☐ |
| 2.1.4 | Operations create | Operations | Create campaign on assigned client | Success | ☐ |

### 2.2 Edit campaign

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 2.2.1 | Edit header fields | Account Manager | Overview → edit dates, team | Saves | ☐ |
| 2.2.2 | Finance read-only edit | Finance | Attempt campaign write | Denied | ☐ |
| 2.2.3 | Add campaign line via assignment | Operations | Create assignment | Line `-A` appears with draft status | ☐ |

### 2.3 Assign influencers

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 2.3.1 | Create assignment | Operations | Assignments → Create → pick vendor | Assignment row + line created | ☐ |
| 2.3.2 | Add deliverables | Operations | Expand assignment → add deliverable/post | Deliverable saved | ☐ |
| 2.3.3 | Multi-currency cost | Operations | Enter cost in non-base currency | FX fields populated | ☐ |
| 2.3.4 | Mark ready for billing | Account Manager | Operational status progression | Status updates correctly | ☐ |

---

## 3. Vendor IO

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 3.1 | Generate VIO | Operations / AM | Select lines → Generate Vendor IO | VIO records created; `operational_status` updated | ☐ |
| 3.2 | Eligibility gate | Operations | Attempt VIO without required fields | Clear error message | ☐ |
| 3.3 | HTML preview | Account Manager | Open VIO document HTML | Branded template renders | ☐ |
| 3.4 | PDF export | Account Manager | `/api/vendor-ios/{id}/document?format=pdf&download=1` | PDF downloads | ☐ |
| 3.5 | Revise VIO | Operations | Revise after conditions met | New revision `/1`; prior superseded | ☐ |
| 3.6 | Ungenerate VIO | Operations | Ungenerate when eligible | Status reverted; invoice link cleared if applicable | ☐ |
| 3.7 | External approval | External (token) | Open `/io-approval/vendor?token=…` | Approve/reject without login | ☐ |
| 3.8 | Finance cannot generate | Finance | Attempt generate | Denied (no campaigns.write) | ☐ |

---

## 4. Client IO

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 4.1 | Generate Client IO | Account Manager | Client IO workflow from campaign/client | Record created with document number | ☐ |
| 4.2 | Terms applied | Account Manager | Client with `client_io_terms_text` | Terms appear in document | ☐ |
| 4.3 | HTML export | Account Manager | API or UI HTML view | Correct layout | ☐ |
| 4.4 | PDF export | Account Manager | `?format=pdf&download=1` | PDF downloads | ☐ |
| 4.5 | Cancel IO | Admin / authorized | Cancel client IO | Status `cancelled` | ☐ |
| 4.6 | Email send | Account Manager | Send IO email (if configured) | Notification logged in `io_notifications` | ☐ |

---

## 5. Billing

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 5.1 | Move to billing | Account Manager | Move operational rows to billing | Billing status updated | ☐ |
| 5.2 | Create invoice (lines) | Finance | Billing tab → create invoice from lines | Invoice header + line items; INV number assigned | ☐ |
| 5.3 | VIO gate | Finance | Attempt invoice without VIO on line | Blocked with clear message | ☐ |
| 5.4 | Append to existing invoice | Finance | Append lines to unlocked same-campaign invoice | Line items added | ☐ |
| 5.5 | Regenerate invoice | Finance | Regenerate when eligible | Line items rebuilt; number preserved | ☐ |
| 5.6 | Ungenerate invoice | Finance | Ungenerate when eligible | Line unlocked; operational status synced | ☐ |
| 5.7 | Invoice document | Finance | `/api/invoices/{id}/document?format=pdf` | PDF/HTML renders | ☐ |
| 5.8 | Post-level billing | Finance | Invoice from posts/deliverables mode | Correct line scope | ☐ |

---

## 6. Finance (approval workflow)

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 6.1 | Financial approval request | Account Manager | Trigger approval-required action | Request in queue | ☐ |
| 6.2 | Finance approve | Finance | Approve request | Status approved; audit entry | ☐ |
| 6.3 | Finance reject | Finance | Reject with reason | Status rejected | ☐ |
| 6.4 | Finance override | Finance / Admin | Request override on locked period | `requireFinanceOverrideAccess` path works | ☐ |
| 6.5 | Period lock | Finance | Soft/full lock financial period | Mutations blocked appropriately | ☐ |
| 6.6 | Posting center | Finance | Post approved entries | Ledger updated | ☐ |
| 6.7 | Collections | Finance | Record collection payment | Allocation saved | ☐ |

---

## 7. Reports

| # | Test | Role | Steps | Expected | Pass |
|---|------|------|-------|----------|:----:|
| 7.1 | Executive dashboard | Viewer | Open analytics dashboard | KPIs load | ☐ |
| 7.2 | P&L export HTML | Finance | `/api/reports/pnl/document?format=html` | Report renders | ☐ |
| 7.3 | P&L export XLSX | Finance | `?format=xlsx&download=1` | Excel downloads | ☐ |
| 7.4 | P&L export PDF | Finance | `?format=pdf&download=1` | PDF downloads (may take ≤60s) | ☐ |
| 7.5 | Report filters | Finance | Apply date range, client filter | Data scoped correctly | ☐ |
| 7.6 | Top clients report | Finance | `/api/reports/top-clients/document` | Export succeeds | ☐ |
| 7.7 | Viewer export denied | Viewer | Attempt report export API | 401/403 or empty per RLS | ☐ |
| 7.8 | VR / profitability reports | Finance | Export remaining report routes | No 500 errors | ☐ |

**Report routes to spot-check:**

- `/api/reports/pnl/document`
- `/api/reports/vr/document`
- `/api/reports/top-clients/document`
- `/api/reports/client-profitability/document`
- `/api/reports/statements/document`
- `/api/reports/unsettled/document`
- `/api/reports/daily/drilldown`

---

## 8. Cross-cutting / security smoke

| # | Test | Steps | Expected | Pass |
|---|------|-------|----------|:----:|
| 8.1 | Unauthenticated redirect | Open `/campaigns` logged out | Redirect to `/login` | ☐ |
| 8.2 | Viewer write denial | Viewer POST to billing action | Error / no effect | ☐ |
| 8.3 | Client scope | AM user A cannot see client B | RLS blocks | ☐ |
| 8.4 | build-info public | Fetch without auth | 200 JSON (no secrets) | ☐ |

---

## 9. Sign-off

| Role | Name | Date | Overall |
|------|------|------|---------|
| Account Manager rep | | | ☐ Pass ☐ Fail |
| Operations rep | | | ☐ Pass ☐ Fail |
| Finance rep | | | ☐ Pass ☐ Fail |
| Admin / Super Admin | | | ☐ Pass ☐ Fail |
| QA lead | | | ☐ Pass ☐ Fail |

**Critical path minimum (must all pass):** 0.1, 1.1.1, 2.1.1, 2.1.3, 2.3.1, 3.1, 3.4, 4.1, 5.2, 5.3, 6.2, 7.2

**Defect log:** Link Linear/Jira tickets for any Fail/Blocked items.

---

## Cross-references

- `docs/CLEAN_LIFECYCLE_VALIDATION.md` — detailed lifecycle SQL checks
- `docs/VENDOR_IO_INVOICE_LIFECYCLE.md` — billing/VIO rules
- `docs/ROLE_MATRIX.md` — expected role behavior
- `docs/GO_LIVE_READINESS.md` — UAT gate in overall readiness
