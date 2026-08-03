# Prompt Summary — Current Sprint

**Branch focus:** `develop` · tip pending Iter 14

**Active:** Release 2.3 Final Product Excellence — Fix → Soak → Fix (reject mode)

**Shipped:**
- Iter 10 (`e521aa1a`): DB-only browse includes imported/oauth vendors — Egypt CIP pool 2→50–60
- Iter 11 (`136ef52b`): Soft-prefer brief categories in slate composition; CIP slate cap 12
- Iter 12 (`94b778eb`): Floor planning confidence at Moderate when CIP slate ≥5
- Iter 13 (`879e47ad`): Demote low campaign-fit creators when stronger fits exist
- Iter 14 (pending push): UAE/`UAE` country alias in CIP validators · coerce LLM `brand`/numeric budget · preserve slate creatorIds on Director merge · confidence floor recovers from slateIntelligence/display

**F1 root cause (soaked on 879e47ad):**
- CIP LLM returned UAE + sports/lifestyle but Zod rejected (`brand` vs `brandName`, numeric budget) → heuristicFallback
- Heuristic labeled geo `UAE` but validators did not resolve `UAE`→`AE` → geography deleted → Egypt creators on UAE brief
- `recommendations.creatorIds` empty while slateIntelligence/display still had 10 — confidence stayed Low

**Pending soaks on Iter 14 tip:** F1 re-soak · Liwa · L'Oréal · e& · Noon · Trendyol · handoff E2E

**Stop condition:** Not met (readiness ~92–94; geo + confidence High blockers in Iter 14)

**FROZEN:** Studio Governance · ECI · Sprint 2/3 packages

**Left local:** Wave 1 Studio live-discovery · Dev readiness docs · tmp inspect scripts
