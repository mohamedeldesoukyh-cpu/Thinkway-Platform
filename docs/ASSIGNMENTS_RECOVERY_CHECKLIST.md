# Assignments production recovery checklist

## Vercel (Production)

1. `ASSIGNMENTS_RENDER_STAGE` = `footer` (includes checkboxes + VIO/invoice actions)
2. `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` = `footer` (remove `static-table`)
3. **Redeploy** after saving env vars
4. Hard refresh: `Ctrl+Shift+R`

## Success

Banner shows **footer**. Grid has operational borders, row tints, expand chevrons, nested children, **Select all / Clear**, and **Generate Vendor IO / invoice** footer.

## Next stages (after footer stable)

`dialogs` → `full`

Update `ASSIGNMENTS_RENDER_STAGE` and redeploy after each step.
