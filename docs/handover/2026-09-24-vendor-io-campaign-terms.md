# Vendor IO campaign terms — 24 September 2026

## Implemented behavior

- Platform Vendor IO defaults contain the 13 clauses supplied in the user's attachment. Existing explicit IO/vendor custom terms retain their precedence.
- Campaign Vendor IO rows, the register, and detail sheets expose a shared editor for usage rights, payment terms (presets or manual text), and compliance country.
- Saves are scoped to both IO and campaign, require vendor_ios.write, reject superseded/stale edits, and do not write CRM defaults or another campaign's IO.
- Compliance defaults to the creator's CRM country. UAE selects the supplied UAE compliance clause; Egypt selects the existing Egypt clause. A per-IO override is available. Missing/unsupported CRM countries preserve the existing Egypt fallback, labeled in the editor.
- The supplied Egypt governing-law clause remains unchanged by compliance-country selection.
- Preview, inline/download PDFs, and PDF email attachments render current saved terms. Term edits invalidate generated-document cache fields without modifying workflow status, delivery history, or signed attachments.
- Revisions carry the country override forward. Revision reasons remain in lifecycle_reason_detail instead of being appended to structured terms JSON.

## Validation completed

- Next production build and TypeScript checks passed. A final removal of the inline PDF cache redirect was followed by another successful TypeScript check.
- Terms, delivery, revision, and billing regression tests passed (11 tests plus 7 legacy scenarios).
- HTML/PDF parity passed for platform defaults, UAE defaults, vendor custom terms, and IO overrides. All four pages of the final UAE PDF were visually inspected.
- Real editor component tests passed for preset/manual entry, blank custom validation, campaign-scoped payload, keyboard dismissal, server errors, and mobile overflow.
- Development SQL transaction test passed: cache invalidation, campaign isolation, preserved CRM defaults/workflow/signed attachments, invalid country rejection, and null reset. Test data changes rolled back.
- Targeted lint and diff whitespace checks passed.

## Deployment status

Application changes are local and are not deployed. Migration 20260924160000_vendor_io_campaign_terms.sql is applied to Development only. Apply it to Production before deploying the corresponding application changes, following explicit Production approval under docs/RELEASE_WORKFLOW.md.

The earlier vendor CRM search changes are also pending application release; see 2026-09-24-vendor-crm-search.md. Do not include unrelated pre-existing workspace edits in this release.

No real IO emails were sent during validation. Previously downloaded or signed documents are not rewritten. Existing custom terms are not bulk replaced by the new platform defaults.

## Rollback considerations

Roll back the application deployment if necessary; the added nullable country column is backward compatible. Preserve saved campaign overrides. Drop the cache-invalidation trigger only if investigation shows it is responsible for a regression; existing application code does not require the trigger to be absent.
