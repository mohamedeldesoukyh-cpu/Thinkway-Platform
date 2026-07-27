# Thinkway deployment checklist

Use this when a hosted environment does not match the expected code or database behavior.

Canonical release process: [`docs/RELEASE_WORKFLOW.md`](./RELEASE_WORKFLOW.md).

## Branch defaults

| Intent | Branch |
|---|---|
| Day-to-day development | `develop` |
| Production release tip | `main` (merged from `develop`) |
| Never | Feature commits directly on `main` |

## 1. Verify the running app

| Surface | Build info |
|---|---|
| Development | https://dev.thinkwaymedia.com/api/build-info |
| Production | https://app.thinkwaymedia.com/api/build-info |

Check:

| Field | Development expected | Production expected |
|---|---|---|
| `gitShaShort` | Tip of `develop` | Tip of `main` (after release) |
| `supabaseAligned` | `true` | `true` |
| `supabaseProjectRef` | `hsxrewjcbvmbkqdlzjhs` | `ienowhwfyxoqtzbgltno` |

Also use Operations Center (`/operations`) for environment / Redis / worker / Release Readiness.

## 2. Align Vercel env

Keep **Preview** (Development host) and **Production** on separate Supabase and Redis values. Never point Production at the Development project.

## 3. Apply database migrations

Always validate migrations on **Development** first:

```bash
# Linked to Development project hsxrewjcbvmbkqdlzjhs
npx supabase db push
npx supabase migration list
```

Production migrations only after explicit approval (see engineering deployment policy).

## 4. Deploy application code

### Development

```bash
git checkout develop
git pull origin develop
# … feature work via feature/* → merge to develop …
git push origin develop
```

Vercel auto-deploys Preview / `dev.thinkwaymedia.com` from `develop`.

### Production (approval required)

1. Merge `develop` → `main` (PR preferred).
2. Obtain explicit approval for Production.
3. Prefer:

```bash
npx vercel deploy --prod --non-interactive
```

Git-triggered Production builds are skipped by default unless the commit message includes `[deploy-production]` / `[force-deploy]` (see `RELEASE_WORKFLOW.md`).

Do **not** treat `git push origin main` as an automatic Production go-live.

## 5. Browser cache

Hard refresh (Ctrl+Shift+R) or use an incognito window after deploy.

## Common symptoms

| Symptom | Likely cause |
|---|---|
| Old UI / missing actions | Stale deployment or wrong host (`dev` vs `app`) |
| `supabaseAligned: false` | Vercel env points at the wrong Supabase project |
| Dev missing features that are live in Prod | `main` diverged ahead of `develop` — merge `main` → `develop` immediately |
| Invoice/VIO buttons missing on lines with IO | `operational_status` stale — run `db push` (includes backfill migration) |
| Assignments tab red error / digest | See **Assignments UI layers** below |
| Assignments / finance errors | Missing migrations on that environment’s Supabase |

## Assignments UI layers (isolation / recovery)

Production defaults to `operational_actions` (checkboxes + VIO footer). Use `rows` to roll back if the tab crashes again.

Set on Vercel **Production** (redeploy after change):

```
NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER=rows
```

Progressive values (enable one step at a time after the tab loads):

| Value | Enables |
|---|---|
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
