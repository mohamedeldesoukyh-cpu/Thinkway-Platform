# Assignments production recovery checklist

## Vercel (Production)

1. `ASSIGNMENTS_RENDER_STAGE` = `expansion`
2. `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` = `expansion` (remove `static-table`)
3. **Redeploy** after saving env vars
4. Hard refresh: `Ctrl+Shift+R`

## Success

Banner shows **expansion** (optionally `production recovery` or `ASSIGNMENTS_RENDER_STAGE`).

Grid shows parent rows + expand chevrons; child deliverable/post rows when expanded.

No checkboxes, VIO footer, or invoice sheets at this stage.

## Next stages (after expansion stable)

`checkboxes` → `footer` → `dialogs` → `full`

Update `ASSIGNMENTS_RENDER_STAGE` and redeploy after each step.
