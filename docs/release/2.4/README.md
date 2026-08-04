# Release 2.4 — Kickoff

**Status:** 🌱 **Prepared** (not yet scoped / not Feature Freeze)  
**Opened after:** Release 2.3 Production Acceptance **PASS** + tag `v2.3.0` (`c23a3a0e`) + Stabilization Production **GO** `v2.3.1` (`e51d16a7` / `ffd31694`)  
**Date:** 2026-08-04 (baseline refreshed)  
**Baseline:** `main` / `develop` @ `ffd31694` (includes `e51d16a7`) · Production `https://app.thinkwaymedia.com` · deploy `dpl_9YTfXFj2gDDZFs85NGhgknEHj3dd`  
**Branch:** `release/2.4` (baseline only — **no implementation**)

---

## Purpose

Open the next initiative window after R2.3 closure. **No architecture redesign and no production deploy** until Product scopes and approves a Release 2.4 package.

---

## Carry-forward candidates (from R2.3 residuals / backlog)

| Theme | Notes | Priority (TBD) |
|---|---|---|
| Client IO recipients / send UX | Fresh TW-2026-0002: document generated; Send gated on recipients | Ops / Commercial |
| OPS-EMAIL Production proof | Carry-forward from R2.2 if Client/Vendor IO outbound still unproven | Ops |
| Wave 1 Studio live-discovery | Explicitly **excluded** from R2.3 tip — decide include/exclude for R2.4 | Product |
| CIP / Studio slate hardening | Hotfixes shipped in R2.3 close tip; soak + regression suite | Eng |
| Inventory hygiene | Older packages with non-resolvable slate IDs | Data |
| Change Impact / Doc Lifecycle depth | Schema live in R2.3 — productize remaining UX | Product |

---

## Governance

| Rule | Application |
|---|---|
| Development first | Implement/test on `develop` + Dev Supabase `hsxrewjcbvmbkqdlzjhs` |
| Production | Only after explicit Production Approval package |
| Feature Freeze | Not in force until Product declares R2.4 freeze |
| Exclusions | Do not ship local `scripts/tmp-*` or unapproved Wave 1 work without Product OK |

---

## Immediate next steps (Product)

1. Confirm R2.4 themes / out-of-scope list.  
2. Author `docs/architecture/RELEASE_2_4_ARCHITECTURE.md` (or equivalent) when scope is agreed.  
3. Open `feature/release-2-4-*` branches from `develop` only after scope approval.

**Do not** treat this README as Production authorization.
