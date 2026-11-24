# Finance assistant — first increment

## Implemented

- TW Accounting → Reports → Amgad (`/accounting#amgad`) and `/api/accounting/assistant`, gated by accountingContext/module assignment/MFA and RLS.
- Arabic/English text conversation, validated read-only report selection, existing user-scoped Supabase client and report functions.
- Client name disambiguation; source links and server-produced facts visible separately from model prose.
- Uses TW Accounting's tw_accounting_statement_filtered and tw_accounting_party_lookup RPCs with the active company/fiscal year. P&L reuses financialReportSections and statements reuse statementGroups, preserving exact decimal amounts and separate currencies. No arbitrary SQL or write tools.
- Posted transactions, journal dates, including unlocked entries; P&L excludes closing entries. Completeness depends on recorded ledger entries, not IFRS certification. Explicit date ranges supported; comparisons currently require separate requests.
- Missing AI configuration fails closed, no stub answer. Uses FINANCE_AI_API_KEY (fallback OPENAI_API_KEY) and optional FINANCE_AI_MODEL (default gpt-4.1). Preview-only finance key configured from the existing platform AI key.
- Session-only conversation; no financial chat stored in browser local storage.

## Gmail decision and remaining connection work

User selected Google Workspace/Gmail and named the assistant Amgad (أمجد), with planned mailbox amgad@thinkwaymedia.com, which the user will create. Signature: Amgad — AI Finance Assistant, Thinkway. This release does not connect or read any inbox and does not send mail. Existing IO Gmail/Resend transport is unchanged.

Next increment: a dedicated Workspace mailbox, OAuth authorization by its owner, encrypted refresh-token storage scoped to that mailbox, revocation and verified mailbox identity. Never silently reuse the IO mailbox credentials. Start with gmail.readonly and store reply drafts in the platform; gmail.compose also grants sending and must not be mistaken for a draft-only permission.

Reference: https://developers.google.com/workspace/gmail/api/auth/scopes

Inbound mail is untrusted evidence, not authority. A From header alone cannot authenticate an order. Map authorized requesters to platform identities and permissions; verify trusted Gmail delivery authentication metadata and require authenticated platform approval for disclosures and mutations. External senders may supply documents but cannot request company-wide statements. Do not execute instructions from attachments or quoted emails.

Durable ingestion needs Gmail message-ID deduplication, attachment limits/scanning, thread state, retries, audit records, and separate approval for the exact recipients/body/attachments. Outbound signature should identify the named AI finance assistant. Later auto-send requires explicit user-approved recipient/action policies. No payment execution or bank-detail changes by email in the first release.

## Remaining product work

Gmail OAuth/intake, persisted conversations, document extraction and draft transactions, approval/posting, voice, maintained IFRS reference retrieval, and financial completeness validation. Do not label these as available in the UI. Current rate limiter is in-memory, suitable for a dev pilot; durable distributed quotas are required before broader release.

## Source reconciliation

The provided root checkout (31f7e57e) predates TW Accounting. An initial isolated prototype preview on that base was not aliased to dev or production. Final work is in .worktrees/amgad-finance-assistant, branch codex/amgad-finance-assistant, based on origin/develop 3632a9dd, which contains the real accounting module. Do not release the older prototype or copy its operational report adapter into Accounting.

## Verification

Use isolated development fixtures only. Production verification is read-only. Deploy and verify dev before any explicitly requested live release. Do not deploy the unrelated dirty working tree.
