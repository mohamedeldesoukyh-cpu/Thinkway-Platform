# Assignments production recovery checklist

## Vercel (Production)

1. `ASSIGNMENTS_RENDER_STAGE` = `footer` (includes checkboxes + VIO/invoice actions)
2. `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` = `footer` (remove `static-table`)
3. **Redeploy** after saving env vars
4. Hard refresh: `Ctrl+Shift+R`

## Success

Banner shows **footer** (or **footer (production recovery (expansion→footer))** if Vercel still has `expansion` set — deploy latest code to auto-upgrade).

Stuck on **expansion**? Set `ASSIGNMENTS_RENDER_STAGE=footer` and redeploy commit `88593ff`+, or deploy this build which auto-upgrades `expansion` → `footer` in Production.

## Next stages (after footer stable)

`dialogs` → `full` (banner auto-hides in Production at `full`)

Update `ASSIGNMENTS_RENDER_STAGE` and redeploy after each step.
