# Prompt Summary — Current Sprint

**Branch focus:** `develop` · tip pending Iter 8

**Active:** Release 2.3 Final Product Excellence — Fix → Soak → Fix (reject mode)

**Root cause (L'Oréal Critical):** Workflow CIP ensure aborted when brand not in catalog → `discoveryEngine: keyword` query `Beauty, Lifestyle` → 0 creators. e& works because brand `E&` exists. Noon/Trendyol/F1/Liwa same risk.

**Iter 8:** Allow workflow CIP create with `allowMissingBrand` (null `brand_id`) so CIP dual-pool + enterprise constraints run for unmatched brands.

**Prior shipped:** Iter 3–7 boardroom/funnel/followers/metadata/geo soft-pass

**FROZEN · Maintenance Mode:** Studio Governance · ECI · Sprint 2/3 packages

**Left local (do not mix):** Wave 1 Studio live-discovery · Dev readiness docs

**Constitution:** `docs/architecture/STUDIO_CAPABILITY_CONTRACT.md`
