# 10 — Finance Module

## Surfaces

`/finance/*`, billing, collections, treasury, posting center, VAT, FX, periods, PO tracker.

## Controls

- Permissions: `finance.read|write|override`, invoice permissions
- MFA for finance/admin roles
- P0 RLS least privilege on FX / finance privileged tables
- Portal isolation (P4)

## Monitoring

Operations Center → Finance tab (invoice counts, approval queue proxies). Posting/export failure instrumentation is a residual enhancement.

