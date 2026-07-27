# Thinkway Platform v1.0.0

## 2026-07-27 — Vendor IO Terms Hierarchy

### Added
- Platform → Vendor Default → Vendor IO Override terms hierarchy for Vendor IOs (Client IO parity).
- Vendor Overview editor for **Vendor IO Default Terms** (Save / Restore Platform Default).
- Structured terms editor on Vendor IO with source badge and “Save as Vendor Default”.
- HTML/PDF document parity regression (`npm run test:vendor-io-terms`).

### Database
- `influencers.vendor_io_terms_text` (nullable JSON terms; NULL = platform default).
- `upsert_vendor_io_from_assignment` seeds new Vendor IOs from vendor defaults.
- Removed legacy permissive influencers allow-all RLS policies so `influencers.write` is enforced.

### Supported exports
- HTML and PDF (Word remains backlog — see `docs/backlog/VENDOR_IO_WORD_EXPORT.md`).

### Docs
- `docs/VENDOR_IO_TERMS.md`
- `docs/release/VENDOR_IO_TERMS_PRODUCTION_READINESS.md`

---

## Highlights

### Infrastructure

- Production deployment completed
- Dedicated Production Worker
- Dedicated Development Worker
- Environment isolation
- Fail-fast validation
- Redis integration
- Disaster recovery validated

### User Experience

- New Thinkway branding
- Browser branding
- Installable desktop application
- Progressive Web App
- Splash screen
- Install prompt
- Version information
- Automatic update notifications

### Platform

- Production-ready deployment
- Improved reliability
- Improved deployment process
- Better operational visibility

### Notes

This is the first production-ready internal release of Thinkway Platform.
