# Amgad accounting operations and report delivery — development

Amgad can diagnose unposted source documents between Media and TW Accounting.
The report lists source amounts, currencies, posting state, prerequisites and
proposed posting/linking operations. It does **not** certify full balance agreement
or detect every manual entry, allocation, duplicate or timing difference.

Eligible documents expose an explicit approval checkbox and button. The existing
`/api/accounting/media-posting` workflow enforces Media Finance write permission,
Accounting management, MFA, source tokens, closed periods, locks, duplicate
prevention and audit records. Chat text never executes a correction. Each approved
operation is read back through `tw_accounting_media_source` and linked to its JV.
If verification is uncertain, the UI blocks another attempt until a fresh report.
No production records have been repaired or created by this implementation.

## Reports

- Client SOAs include account summaries and all entry rows up to 1,000 rows;
  incomplete, duplicate or changing pagination is rejected.
- Custom ledger reports support selected columns, explicit account-code prefixes,
  date ranges and the existing currency display modes. Currency is always shown.
  Definitions can be saved privately by their owner and rerun. Dates are resolved
  before saving/export, so switching fiscal years does not silently change scope.
- System PDF downloads rerun the permitted report against authenticated records.
  PDFs use embedded local brand/fonts and the existing Chromium renderer.
- Prepared internal email replies include a PDF from the exact retrieved evidence.
  The signed, short-lived approval binds recipient, body and attachment bytes.
  HTML output escapes all data. No external client/CC workflow is enabled here.

## Email queue

Signed Resend `inbox.email.received` events for Amgad only can enqueue canonical
messages from the three approved senders. The database provides unique email IDs,
exclusive leases, bounded attempts, revocable company/year delegation, fixed
read-only operations and daily sender limits. Sending uses a stable idempotency
key and retained PDF bytes. Uncertain delivery stops for review before the
provider's idempotency window expires.

Automatic delivery requires both production environment and
`FINANCE_MAIL_AUTO_SEND_ENABLED=true`. Manual reviewed sending separately requires
`FINANCE_MAIL_SEND_ENABLED=true`. Both remain disabled on dev. Webhook installation
and `FINANCE_MAIL_WEBHOOK_SECRET` are still required; adding code alone does not
activate incoming automation. Preview cron does not provide a continuous worker;
the dev UI offers explicit queue processing.

## Development migrations, in order

1. `20261129010000_finance_mail_automation.sql`
2. `20261129020000_finance_mail_report_details.sql`
3. `20261129030000_finance_mail_pdf.sql`
4. `20261129040000_finance_saved_reports.sql`

All four have been applied to the development database only. Production release
requires separate explicit authorization and prior dev verification. Roll back
application code rather than deleting stored reports, queue history or journals.

## Verification

- Finance assistant tests cover planning boundaries, exact decimal evidence,
  pagination failures, empty-report wording, recipient checks, signed webhook
  verification and PDF approval tampering.
- `scripts/test-finance-mail-automation.sql`: dev transaction with rollback;
  deduplication, leases, read delegation, sender policy and retry expiry.
- `scripts/test-finance-saved-reports.sql`: dev transaction with rollback;
  ownership forgery and cross-user reads/deletes denied.
- Existing `scripts/test-tw-accounting-media-posting.sql`: dev rollback fixtures;
  source types, same-serial reposting, accrual clearing and duplicate prevention.
- `scripts/render-amgad-pdf-fixture.ts`: isolated bilingual 65-entry artifact;
  all three compact rendered pages visually inspected; P&L summary verified on one page. No business records are created.

## Remaining requested capabilities

Full Media/Accounting balance reconciliation; uploaded bank/client PDF or CSV
statement reconciliation; broader correction proposal/execution types; comparative
financial analysis; external client statements/payment follow-ups with reviewed
To/CC; unsettled-item statements; background webhook activation; voice and a
maintained IFRS reference source remain separate unfinished work. Existing prompts
and UI must not claim those capabilities are already active.
