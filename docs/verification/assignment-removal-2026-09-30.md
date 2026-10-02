# Assignment removal after an accepted Client IO

- Assignment row actions: **Replace creator / edit** and **Remove from campaign**.
- Selecting one assignment exposes the same options in the selection bar.
- Replacement uses the existing editor, retaining entered commercial values.
- Removal requires a reason and cancels active scope; it does not delete the creator, assignment, original IO snapshot, IO composition, or approval history.
- Issued Client IOs are marked Revision Required with an audited previous status. Create an amendment, select the remaining/new assignments, generate, and obtain client approval. No email is sent automatically.
- Existing Vendor IOs, billing allocations, payments, or publications must be resolved before removal. A legacy issued IO without a frozen snapshot blocks removal instead of changing historical content.
- Cancelled assignments are excluded from active campaign totals, billing, and new IO selection. An amendment copies only still-active prior selections; newly added assignments can be selected in its composer.

## Verification

- TypeScript: passed.
- Focused Client IO / campaign / document lifecycle suite: 27 tests passed.
- Development SQL regression with authenticated role/RLS, temporary fixtures, full rollback: passed. Covers permission, wrong campaign, required reason, billing guard, missing-snapshot rollback, preserved prices/snapshot/junction, approval transition audit, PO totals, idempotency and stale editor rejection.
- Migration applied to development; no customer assignment was removed during testing.
- Focused lint: new dialog/action pass; pre-existing set-state-in-effect errors and unused imports remain in the existing grid/footer.

Migration: `20260930110000_remove_campaign_assignment.sql` (atomic RPC and stale-write guards).
