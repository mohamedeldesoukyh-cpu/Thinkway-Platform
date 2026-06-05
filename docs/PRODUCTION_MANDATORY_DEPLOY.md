# Production mandatory deploy — clean lifecycle architecture

**Do not test on stale preview URLs.** Production was serving commit `698a3ec` (render-stage bisect) while cleanup lived only in local uncommitted files.

Execute in order. Do not skip steps.

---

## Step 0 — Commit and push (blocker)

All clean-lifecycle changes must be on `main` before redeploy:

```bash
git add -A
git status   # review: no .env secrets
git commit -m "feat(campaigns): remove operational bootstrap and render-stage bisect"
git push origin main
```

Record the new commit SHA — you will verify it in Step 1.

---

## Step 1 — Full production redeploy

1. Vercel → **Production** → Deployments → wait for `main` build to finish (or **Redeploy** latest).
2. Open: `https://<your-production-domain>/api/build-info`

**Pass criteria:**

```json
{
  "architecture": { "version": "2026-06-clean-lifecycle-v1" },
  "legacyAssignmentsEnvPresent": false,
  "gitSha": "<matches Step 0 commit>",
  "hints": []
}
```

**UI pass criteria (any campaign workspace):**

- No `Assignments render stage:` banner
- No JSON emergency Assignments view
- New campaign: no Line A, no `— Other`, no auto deliverables

---

## Step 2 — Apply migrations (Supabase SQL Editor)

Run in order on **thinkway-dev** (`hsxrewjcbvmbkqdlzjhs`):

1. `supabase/migrations/20260608010000_campaign_line_status_invariants.sql`
2. `supabase/migrations/20260608020000_operational_entity_integrity.sql`
3. `supabase/migrations/20260609000000_disable_operational_bootstrap.sql`
4. `supabase/migrations/20260609010000_campaign_document_sequence_reseed.sql`

---

## Step 3 — Delete invalid campaigns + purge shells + reseed counter

**Full delete** TW-2026-2 and TW-2026-3 (bootstrap artifacts):

```sql
-- File: supabase/scripts/delete_bootstrap_campaigns_and_reseed.sql
-- v_execute := 0  preflight + sequence dry-run
-- v_execute := 1  delete headers + reseed TW-2026 counter
```

**Verify no orphan bootstrap shells remain:**

```sql
SELECT * FROM public.campaign_bootstrap_shell_lines;
-- Must return 0 rows after full delete
```

**Verify sequence** (if only TW-2026-1 survives, `last_value` must be `1`, next campaign → TW-2026-2):

```sql
SELECT * FROM document_sequences WHERE prefix = 'TW-2026';
SELECT * FROM public.reseed_thinkway_campaign_sequence(2026, true);
```

Numbering source: `document_sequences.prefix = 'TW-YYYY'` + `next_document_number()` trigger on `campaign_headers` insert — **not** MAX() at insert time. Reseed is required after deleting invalid headers during controlled reset.

**After production is stable:** do not reseed for routine deletes — gaps are intentional for audit integrity.

---

## Step 4 — Remove obsolete Vercel env vars

Delete from **Production** (and Preview if set):

| Variable | Action |
|----------|--------|
| `ASSIGNMENTS_RENDER_STAGE` | Delete |
| `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` | Delete |
| `ASSIGNMENTS_ALLOW_RENDER_BISECT` | Delete |
| `NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER` | Delete (optional; code ignores) |

**Redeploy** after env change (env does not affect already-built client bundles until redeploy).

---

## Step 5 — Hard refresh

- `Ctrl + Shift + R` on campaign workspace
- Or incognito window to avoid stale JS chunks

---

## Step 6 — Fresh campaign validation

Create a **new** campaign (not TW-2026-2/3).

| Surface | Expected |
|---------|----------|
| Assignments | Empty + **Create assignment** CTA |
| Deliverables | 0 |
| Billing | 0 |
| Vendor IO | 0 |

**SQL (replace campaign id):**

```sql
SELECT
  (SELECT count(*) FROM campaign_lines WHERE campaign_header_id = '<id>') AS lines,
  (SELECT count(*) FROM assignment_deliverables WHERE campaign_header_id = '<id>') AS deliverables,
  (SELECT count(*) FROM vendor_ios WHERE campaign_header_id = '<id>') AS vendor_ios,
  (SELECT count(*) FROM invoice_line_items ili
   JOIN campaign_lines cl ON cl.id = ili.campaign_line_id
   WHERE cl.campaign_header_id = '<id>') AS invoice_line_items;
```

All counts **0** before first assignment.

Server log on create: `[create-campaign] header only — no campaign_lines bootstrap`

---

## Step 7 — Lifecycle validation (only after Step 6 passes)

1. Create assignment → one line `-A`, draft statuses
2. Add deliverables manually
3. Generate Vendor IO → `io_generated`
4. Generate invoice → `invoiced`, `invoice_id` set
5. Ungenerate invoice
6. Revise Vendor IO → `/1`, `/2` numbering
7. Re-invoice

**Red flags:** emergency JSON view, synthetic rows, `reopened` + `invoiced`, duplicate child keys, stale `invoice_id`.

Full checklist: `docs/CLEAN_LIFECYCLE_VALIDATION.md`

---

## Architecture enforcement layers

| Layer | Enforcement |
|-------|-------------|
| UI | Empty state; no bisect banners; no bootstrap compatibility paths |
| Server actions | `createCampaignAction` header-only; no synthetic deliverable insert |
| Helpers | `ensureBillableDeliverablesForLine` requires explicit deliverables |
| Hierarchy | No `buildSyntheticDeliverable` injection |
| DB | Status invariants migration; `campaign_bootstrap_shell_lines` audit view |

**Rule:** Operational state is created only by explicit user lifecycle actions.
