# Billing handoff: vendor payables

Owner: Billing / Vendor payments implementation. No named assignee is set by this change.

The complete shipped payable UI, campaign filter, currency subtotals, Schedule action and audit-log due-date storage are preserved on remote branch `codex/billing-payables-preserved` at commit `353bb0b8`. Port these into Billing rather than reintroducing a Collections tab. Existing audit records are retained.

Outstanding AP must never sum native currencies: the 54-row snapshot has EGP 1,430,200, AED 30,000 and USD 23,317 open. Paid is EGP 580,000 and USD 654. Keep currency totals separate unless using explicit persisted FX rates and their dates. The preserved implementation and `lib/vendor-payables/currency-totals.test.ts` cover this.

Payable assignments have no due_date column. The preserved Schedule action stores due dates in `collection_audit_logs` with action `payable_due_date_set`, entity_type `assignment`, metadata.due_date. Billing should read existing records and offer urgency sorting by the recorded due date, leaving unknown dates explicitly unset. Any migration to a dedicated due_date field requires a separately agreed schema change and preservation of those records.
