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

Full Media/Accounting balance reconciliation; broader operational correction
types; continuous incoming email delivery on protected dev; email attachment
processing and a maintained IFRS reference source remain unfinished. Document
uploads now prepare reviewed journal proposals (see the verification below).
Existing prompts and UI must not claim the unfinished capabilities are active.

## Extended workflows (2026-11-24)

- P&L comparison aligns account/classification/currency, calculates exact decimal
  changes, and suppresses misleading percentages for zero/negative bases.
- Current client unsettled statements use open invoices and current allocations;
  they explicitly do not claim historical outstanding balances or complete SOAs.
- CSV reconciliation checks opening + movement = closing, requires one account
  and currency, lists exact reference/date/amount match candidates, and preserves
  duplicate/ambiguous/unmatched rows. It does not clear or post records.
- PDF/PNG/JPEG statement extraction uses the configured OpenAI provider, validates
  structured output, retains page/row references and requires review of editable
  rows before reconciliation. Maximum 3 MB input / 500 extracted rows; CSV up to
  2 MB / 2,000 rows; ledger snapshots limited to 1,000 entries.
- Report email preparation supports explicit To/CC, English/Arabic templates,
  optional notes, payment follow-ups from current unsettled statements and signed
  exact-PDF previews. Sending is gated to production plus the explicit send flag.
  No dev reports can be sent. Provider idempotency uses the reviewed draft nonce.
- All detailed ledger pages now load under one STABLE database snapshot. Mail
  delegation supports custom account filters and current outstanding reports.
- Verified webhook receipts now start a bounded worker after the response;
  durable queue/leases and cron retries remain in place. Webhook registration and
  secret configuration are still required for actual continuous operation.

Migrations 20261129050000 and 20261129060000 applied to development only. Queue,
filtering and delegation SQL checks passed with rollback. 52 focused tests passed;
TypeScript and focused lint passed. Dev deployment c9f3d95f built successfully and
was aliased to dev.thinkwaymedia.com. Browser verification confirmed the comparison
table, Arabic email preview with explicit To/CC, disabled sending and exact PDF
download. The downloaded comparison PDF was rendered and visually checked (one
landscape A4 page). Browser connection failed during the CSV chooser test; CSV/PDF
upload and reconciliation browser verification is incomplete.

Follow-up fixes cover deterministic zero-comparison wording (no unsupported claim
of no transactions), and optional Arabic/English browser dictation. Dictation only
fills editable request text, never submits automatically; microphone recognition
requires user interaction and has not been exercised with real audio.

CI for c9f3d95f passed its functional checks/build but failed performance budgets:
total CSS 1574.6 KiB > 1550 (pre-existing) and explicit client boundaries 901 > 900.
Three assistant child components now inherit their existing client parent; the
boundary manifest/guard verifies this arrangement (899 explicit client modules).
The CSS threshold has not been changed. Release is not fully validated while that
failure remains.

## Detailed reconciliation and document proposals verified (2026-11-24)

Commit 4262b730 adds individual unmatched-entry contributions, source references,
age, possible causes and proposed review actions. Exact reference/date/amount
matching remains conservative: ambiguous candidates are never silently allocated.
The opening difference plus unmatched statement entries minus unmatched ledger
entries must equal the closing difference. Inconsistent ledger evidence fails.
Browser upload, extraction and reconciliation succeeded; the six-page detailed
PDF was rendered and inspected. No accounting balances were changed.

PDF/image invoices and receipts can prepare base-currency journal proposals using
the actual active chart. Exact balance, fiscal-year dates, account eligibility
and source references are validated; duplicate references and assumptions are
shown for review. The reviewed proposal opens the existing General JV editor and
retains its source file for attachment after saving. No automatic saving, posting
or serial allocation. A synthetic 100 EGP cash receipt reached the correct editor
with balanced lines, then was discarded without creating a business record.
57 focused assistant/access checks and 13 journal regression tests passed, as did
TypeScript, focused lint and the Vercel build.

## Real email draft verification (2026-11-24)

The user approved automatic dev draft preparation with sending disabled. Resend's
incoming-email webhook and branch-scoped signing secret are configured. The
original event was blocked by Vercel Authentication (401). A user-approved
temporary share link for one immutable preview returned a 307 redirect, which
Resend did not deliver through. The share link was revoked and the webhook URL
restored to `https://dev.thinkwaymedia.com/api/webhooks/finance-mail`. Automatic
delivery to protected dev is **not verified or operational**; do not equate the
configured secret with successful delivery.

The retained owner's November P&L request was manually queued through the
authenticated dev UI and processed by the durable worker. It reached `prepared`
on its first attempt with one persisted 73,604-byte PDF and no outbound email ID.
The exact attachment was downloaded from dev storage, rendered and inspected:
one landscape A4 page with November 1–30 2026 scope and EGP dev balances. This
verifies worker preparation and PDF persistence, not automatic webhook receipt.

Prepared-request history now offers authenticated PDF downloads of the retained
bytes; queue RLS/current administrator access still apply. No PDF base64 is loaded
in the history list. Valid Resend messages with null subjects or unknown
attachment sizes are accepted without weakening sender/Reply-To checks.

Artifacts are in `C:/thinkway-platform/.tmp/finance-assistant-release/`:
`amgad-queued-pnl-dev.pdf`, `amgad-queued-draft-verified.png`,
`amgad-preview-access-revoked.png`, and `amgad-webhook-restored.png`.
Live remains unchanged. All outgoing mail is disabled on dev. The pre-existing
CSS release gate remains unresolved; no thresholds were changed.
