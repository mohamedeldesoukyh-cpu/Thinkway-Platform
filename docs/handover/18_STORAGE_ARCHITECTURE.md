# 18 — Storage Architecture

## Buckets (representative)

| Bucket | Access model |
|--------|----------------|
| `campaign-publication-media` | Internal + `campaigns.read` (P4); service_role for workers |
| `creator-imports` | Discovery permissions; immutable user updates |
| Client/Vendor IO docs | Permission-scoped private buckets + signed URLs |

## Rules

- No public buckets for IO/finance docs  
- Portal cannot call internal export APIs  
- Signed URLs short-lived; generated server-side  

See `docs/security/STORAGE_SECURITY_REVIEW.md`.

