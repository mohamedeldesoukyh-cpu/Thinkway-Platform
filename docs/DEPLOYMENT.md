# Thinkway deployment checklist

Use this when production does not match the latest code or database behavior.

## 1. Verify the running app

Open (no login required):

```
https://thinkway-platform.vercel.app/api/build-info
```

Check:

| Field | Expected |
|-------|----------|
| `gitShaShort` | Latest commit on `main` (compare with GitHub) |
| `supabaseAligned` | `true` |
| `supabaseProjectRef` | `hsxrewjcbvmbkqdlzjhs` |
| `schema.operationalStatusReadable` | `true` (after signing in and re-opening the URL) |
| `schema.vendorIoSupersededReadable` | `true` (after signing in) |

If `supabaseAligned` is `false`, Vercel **Production** is pointing at a different Supabase project than the one where you ran `supabase db push`.

## 2. Align Vercel Production env

In [Vercel → thinkway-platform → Settings → Environment Variables](https://vercel.com) (Production):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://hsxrewjcbvmbkqdlzjhs.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key from that same project (Supabase → Settings → API)

Redeploy after changing env vars.

## 3. Apply database migrations

From the repo root (linked to **thinkway-dev** / `hsxrewjcbvmbkqdlzjhs`):

```bash
npx supabase db push
```

Confirm with:

```bash
npx supabase migration list
```

Local and Remote columns must match for all `202606*` migrations.

## 4. Deploy application code

Commit and push so Vercel’s Git integration matches your workspace:

```bash
git add -A
git commit -m "Your message"
git push origin main
```

Vercel deploys `main` automatically. For an emergency CLI deploy from the current folder:

```bash
npx vercel --prod
```

Compare `gitShaShort` on `/api/build-info` with `git log -1 --oneline` locally.

## 5. Browser cache

Hard refresh (Ctrl+Shift+R) or open an incognito window on `https://thinkway-platform.vercel.app`.

## Common symptoms

| Symptom | Likely cause |
|---------|----------------|
| Old UI layout, no assignment footer actions | Old deployment or wrong URL |
| Invoice/VIO buttons missing on lines with IO | `operational_status` stale — run `db push` (includes backfill migration) |
| Server errors on campaign workspace | Prod Supabase missing Phase 1/2 migrations |
| Document numbers still show `0001` padding | Old JS bundle — redeploy + hard refresh |
| Assignments tab red error / digest | See **Assignments UI layers** below |

## 6. Assignments UI layers (isolation / recovery)

Production defaults to `operational_actions` (checkboxes + VIO footer). Use `rows` to roll back if the tab crashes again.

Set on Vercel **Production** (redeploy after change):

```
NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER=rows
```

Progressive values (enable one step at a time after the tab loads):

| Value | Enables |
|-------|---------|
| `minimal` | 4-column static table only |
| `rows` | Full parent rows, text status labels (no checkboxes) |
| `expansion` | Expand deliverable/post children + line edit sheet |
| `billing_pills` | Ops + billing badge components |
| `operational_actions` | Selection checkboxes + VIO footer (default) |
| `invoice_dialogs` | Invoice generation sheets |

Server logs for skipped rows: `[assignment-hierarchy] group mapping failed` or `row render failed`.

Debug render chain (Vercel runtime logs): `[Assignments]` with `page query success`, `tab entry`, `safe grid render start`.

**Assignments render bisect removed** — delete `ASSIGNMENTS_RENDER_STAGE` and `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` from Vercel if still set. The tab always uses the full safe grid (checkboxes, footer, invoice sheets).

On failure: `AssignmentsTabErrorFallback` plus console `[Assignments] tab boundary`. See `docs/CLEAN_LIFECYCLE_VALIDATION.md`.

**Post–Vendor IO revise:** check `[revise-vendor-io] billing_finalize_complete` and console warnings for duplicate child keys.
