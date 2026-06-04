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

Debug render chain (Vercel runtime logs): `[Assignments]` with stages `page query success`, `hierarchy built`, `tab entry`, `render stage active`.

**Render isolation** — set on Vercel **Production** (redeploy after each change; env does not affect old deployments):

| Variable | Role |
|----------|------|
| `ASSIGNMENTS_RENDER_STAGE` | **Preferred** — server resolves stage and passes to Assignments tab |
| `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` | Baked into client JS at build time — must match after redeploy |

If Production still has `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE=static-table` but you deploy the latest code, the server **auto-upgrades to `expansion`** unless you set `ASSIGNMENTS_RENDER_STAGE=static-table` explicitly.

Stages (`NEXT_PUBLIC_*` or `ASSIGNMENTS_RENDER_STAGE`):

| Stage | What renders |
|-------|----------------|
| `bypass` | Text only: `ASSIGNMENTS SAFE TEST` |
| `static-table` | Plain HTML `<table>` — **debug / bisect only** |
| `text-status` | + creator, ops, billing columns |
| `columns` | + revenue, deliverable count |
| `safe-grid` | Safe grid — plain rows, text ops/billing |
| `row-styling` | + left border row tint (`reopened`, `invoiced`, etc.) |
| `pills` | + Ops + billing badge components (still plain rows) |
| `expansion` | **Recovery checkpoint** — full parent rows, expand toggle, platforms/dates/GP, nested deliverable/post rows when expanded (no checkboxes/footer/dialogs) |
| `deliverables-children` | Same child rendering as `expansion` (confirm-only bisect step) |
| `checkboxes` | + line selection checkboxes |
| `footer` | + VIO / invoice / revise footer (`useTransition`, not `useActionState`) |
| `dialogs` | + invoice generation sheets |
| `full` | **Production default** — full grid, children, checkboxes, footer, sheets |

**Production recovery (now):**

1. Vercel → Settings → Environment Variables → **Production**
2. Set `ASSIGNMENTS_RENDER_STAGE` = `expansion`
3. Set `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` = `expansion` (remove `static-table`)
4. Deployments → latest → **Redeploy**
5. Hard refresh (`Ctrl+Shift+R`)
6. Banner must read: `Assignments render stage: expansion` (source: `ASSIGNMENTS_RENDER_STAGE` or `production recovery`)

**After verified:** `checkboxes` → `footer` → `dialogs` → `full`.

On failure the tab shows JSON emergency rows with the real error message.

**Post–Vendor IO revise:** if a stage fails, check browser console for `[Assignments] ROW STATUS` / `ROW VIO` and `duplicate post id` / `duplicate deliverable id` warnings from sanitize.
