# UAT Execution Guide — Business Users

**Purpose:** Step-by-step tests for pilot sign-off. No technical knowledge required.  
**Environment:** Pilot URL (Vercel preview or `app.thinkway.com`)  
**Build:** `e0c77d6` or later  
**Duration:** ~4–6 hours across roles (can split over 2 days)

**How to use:** Each tester completes only their role section. Mark **Pass ☐** or **Fail ☐**. If Fail, write what happened in the Notes column.

---

## Before you start (all testers)

| Step | Action | Pass |
|------|--------|:----:|
| 0.1 | Confirm IT has applied migrations (ask Ops — see `MIGRATION_VERIFICATION.md`) | ☐ |
| 0.2 | Open pilot URL in Chrome or Edge | ☐ |
| 0.3 | Sign in with your assigned test account | ☐ |
| 0.4 | Confirm you see the Thinkway sidebar (Clients, Campaigns, etc.) | ☐ |

**Test accounts needed:**

| Role | Maps to Thinkway role | Email (fill in) |
|------|----------------------|-----------------|
| Sales | Account Manager | |
| Operations | Operations | |
| Finance | Finance | |
| Admin | Super Admin or Admin | |

---

# SALES (Account Manager)

*You manage clients and campaigns. You do not approve invoices.*

---

### S1 — Create a new client

| Step | Action |
|------|--------|
| 1 | Go to **Clients** in the sidebar |
| 2 | Click **New client** (or equivalent create button) |
| 3 | Enter a unique **Client name** (e.g. `UAT Test Client Jun19`) |
| 4 | Select **Group**, set **Status** to Active |
| 5 | Accept or set **Category** and **Subcategory** |
| 6 | Click **Save** |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Client appears in the clients list | ☐ | ☐ | |
| No error message | ☐ | ☐ | |

---

### S2 — Edit client overview

| Step | Action |
|------|--------|
| 1 | Open the client you created (S1) |
| 2 | Go to **Overview** tab |
| 3 | Change **Notes** or **Website** |
| 4 | Click **Save changes** (or Ctrl+S) |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Success message shown | ☐ | ☐ | |
| After refresh, changes still visible | ☐ | ☐ | |

---

### S3 — Category visible on new campaign

| Step | Action |
|------|--------|
| 1 | Go to **Campaigns** |
| 2 | Click **New campaign** |
| 3 | Select **Group**, **Client** (from S1), and a **Brand** |
| 4 | Look at the **Commercial profile** section |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| **Category** and **Subcategory** show labels (not "—") | ☐ | ☐ | |
| Client name matches selection | ☐ | ☐ | |

---

### S4 — Create a campaign

| Step | Action |
|------|--------|
| 1 | In New campaign dialog, enter **Campaign name** (e.g. `UAT Campaign Jun19`) |
| 2 | Set **Currency**, **Status** = Draft |
| 3 | Click **Create campaign** |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Campaign created; opens workspace or appears in list | ☐ | ☐ | |
| Campaign number format `TW-2026-XXXX` assigned | ☐ | ☐ | |

---

### S5 — Sales cannot access finance approvals

| Step | Action |
|------|--------|
| 1 | Try to open **Finance** → approval queue or posting (if visible) |
| 2 | Attempt any **Approve invoice** action if shown |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Finance write actions denied or not visible | ☐ | ☐ | |

---

**Sales section sign-off:** Tester _______________ Date __________ Pass ☐ Fail ☐

---

# OPERATIONS

*You run campaigns, assign vendors, and generate Vendor IOs.*

---

### O1 — Open campaign assignments

| Step | Action |
|------|--------|
| 1 | Open the campaign from **S4** (or any test campaign) |
| 2 | Go to **Assignments** tab |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Assignments tab loads; no error page | ☐ | ☐ | |
| No auto-created "Line A" bootstrap (empty campaign shows empty state) | ☐ | ☐ | |

---

### O2 — Create vendor assignment

| Step | Action |
|------|--------|
| 1 | Click **Create** (or add assignment) |
| 2 | Select a **Vendor / Influencer** |
| 3 | Save the assignment |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Assignment row appears in grid | ☐ | ☐ | |
| Campaign line code assigned (e.g. `-A`) | ☐ | ☐ | |

---

### O3 — Add deliverable

| Step | Action |
|------|--------|
| 1 | Expand the assignment from O2 |
| 2 | Add a **Deliverable** with platform, type, quantity |
| 3 | Enter **Cost** and **Revenue** if required |
| 4 | Save |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Deliverable saved and visible | ☐ | ☐ | |

---

### O4 — Generate Vendor IO

| Step | Action |
|------|--------|
| 1 | Select assignment line(s) eligible for VIO |
| 2 | Click **Generate Vendor IO** in the bottom action bar |
| 3 | Confirm generation |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Success message; VIO record created | ☐ | ☐ | |
| No error toast | ☐ | ☐ | |

---

### O5 — Export Vendor IO PDF

| Step | Action |
|------|--------|
| 1 | Open the generated Vendor IO document (preview or link) |
| 2 | Download or view **PDF** |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| PDF opens or downloads | ☐ | ☐ | |
| Document shows vendor and campaign details | ☐ | ☐ | |

---

### O6 — Billing queue updates without refresh

| Step | Action |
|------|--------|
| 1 | After O4, switch to **Billing** tab (same campaign) |
| 2 | Do **not** hard-refresh the browser |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Billing queue shows rows ready for invoicing | ☐ | ☐ | |

---

### O7 — Generate Client IO

| Step | Action |
|------|--------|
| 1 | Go to **Client IO** tab on campaign (or client workspace) |
| 2 | Generate Client IO for eligible lines |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Client IO created with document number | ☐ | ☐ | |
| PDF/HTML export works | ☐ | ☐ | |

---

### O8 — Operations cannot approve invoices

| Step | Action |
|------|--------|
| 1 | Attempt to create or approve an invoice (if button visible) |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Action denied or button not available | ☐ | ☐ | |

---

**Operations section sign-off:** Tester _______________ Date __________ Pass ☐ Fail ☐

---

# FINANCE

*You manage billing, invoices, approvals, and reports.*

---

### F1 — View billing queue

| Step | Action |
|------|--------|
| 1 | Open a campaign with generated VIO (from O4) |
| 2 | Go to **Billing** tab |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Billable lines visible | ☐ | ☐ | |

---

### F2 — Create invoice

| Step | Action |
|------|--------|
| 1 | Select billable lines |
| 2 | Click **Create invoice** (or equivalent) |
| 3 | Complete the flow |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Invoice created with number (INV-…) | ☐ | ☐ | |
| Line items match selected assignments | ☐ | ☐ | |

---

### F3 — Invoice blocked without Vendor IO

| Step | Action |
|------|--------|
| 1 | Find a line **without** Vendor IO |
| 2 | Attempt to invoice it |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Clear error: VIO required | ☐ | ☐ | |

---

### F4 — Regenerate invoice

| Step | Action |
|------|--------|
| 1 | Open an existing unlocked invoice |
| 2 | Click **Regenerate** (if eligible) |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Line items rebuilt; invoice number unchanged | ☐ | ☐ | |

---

### F5 — Export invoice PDF

| Step | Action |
|------|--------|
| 1 | Open invoice document / PDF export |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| PDF renders with client, amounts, line items | ☐ | ☐ | |

---

### F6 — Finance approval workflow

| Step | Action |
|------|--------|
| 1 | Go to **Finance** → Approvals (or approval queue) |
| 2 | Open a pending approval |
| 3 | **Approve** one request |
| 4 | **Reject** another (with reason) if available |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Approve updates status | ☐ | ☐ | |
| Reject records reason | ☐ | ☐ | |

---

### F7 — Finance cannot create campaigns

| Step | Action |
|------|--------|
| 1 | Go to **Campaigns** → **New campaign** |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Create denied or not available | ☐ | ☐ | |

---

### F8 — Export P&L report

| Step | Action |
|------|--------|
| 1 | Go to **Reports** or **Finance** → P&L |
| 2 | Set date range |
| 3 | Export **HTML** or **PDF** |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Report loads with data | ☐ | ☐ | |
| Export downloads without error | ☐ | ☐ | |

---

**Finance section sign-off:** Tester _______________ Date __________ Pass ☐ Fail ☐

---

# ADMIN

*You verify security, users, settings, and cross-role access.*

---

### A1 — User management

| Step | Action |
|------|--------|
| 1 | Go to **Settings** → **Users** (or Administration) |
| 2 | View user list |
| 3 | Confirm test accounts exist for Sales, Operations, Finance |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| All pilot users listed with correct roles | ☐ | ☐ | |

---

### A2 — Role escalation blocked

| Step | Action |
|------|--------|
| 1 | Sign in as **Account Manager** (not admin) |
| 2 | Attempt to change own role to Admin (via Settings if exposed, or ask IT to run DB test per `MIGRATION_VERIFICATION.md` §3.1) |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Role change blocked | ☐ | ☐ | |

---

### A3 — Viewer read-only

| Step | Action |
|------|--------|
| 1 | Sign in as **Viewer** |
| 2 | Browse Clients and Campaigns |
| 3 | Attempt to create or edit anything |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Can view lists and workspaces | ☐ | ☐ | |
| Cannot save changes | ☐ | ☐ | |

---

### A4 — Classification review (if enabled)

| Step | Action |
|------|--------|
| 1 | Go to **Settings** → **Classification Review** |
| 2 | Approve or reject one queued item |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Queue loads; action saves | ☐ | ☐ | |

---

### A5 — Build verification

| Step | Action |
|------|--------|
| 1 | Open `https://<pilot-url>/api/build-info` |
| 2 | Confirm `gitShaShort` = `e0c77d6` (or later) |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Correct build deployed | ☐ | ☐ | |
| `legacyAssignmentsEnvPresent: false` | ☐ | ☐ | |

---

### A6 — Legal document upload

| Step | Action |
|------|--------|
| 1 | Open any client → **Legal** tab |
| 2 | Attach a small PDF to **Trade license** field |
| 3 | Click the paperclip to view |

| Expected result | Pass ☐ | Fail ☐ | Notes |
|-----------------|:------:|:------:|-------|
| Upload succeeds; no server error | ☐ | ☐ | |
| Document viewable | ☐ | ☐ | |

---

**Admin section sign-off:** Tester _______________ Date __________ Pass ☐ Fail ☐

---

## Critical path summary (must all pass for pilot)

| ID | Test | Role | Pass |
|----|------|------|:----:|
| CP1 | S1 Create client | Sales | ☐ |
| CP2 | S4 Create campaign | Sales | ☐ |
| CP3 | O2 Create assignment | Operations | ☐ |
| CP4 | O4 Generate Vendor IO | Operations | ☐ |
| CP5 | O5 Export VIO PDF | Operations | ☐ |
| CP6 | O6 Billing queue updates | Operations | ☐ |
| CP7 | F2 Create invoice | Finance | ☐ |
| CP8 | F3 VIO gate | Finance | ☐ |
| CP9 | F6 Approval workflow | Finance | ☐ |
| CP10 | A2 Role escalation blocked | Admin | ☐ |

---

## Final UAT sign-off

| Role | Tester | Date | Section result |
|------|--------|------|----------------|
| Sales | | | ☐ Pass ☐ Fail |
| Operations | | | ☐ Pass ☐ Fail |
| Finance | | | ☐ Pass ☐ Fail |
| Admin | | | ☐ Pass ☐ Fail |
| **Overall pilot UAT** | | | ☐ **Pass** ☐ **Fail** |

**Defect log:** Record any Fail with screenshot + steps → share with Engineering.

---

## Cross-references

- `docs/UAT_CHECKLIST.md` — full technical checklist
- `docs/UAT_EXECUTION_REPORT.md` — engineering verification
- `docs/PILOT_LAUNCH_CHECKLIST.md` — launch gates
