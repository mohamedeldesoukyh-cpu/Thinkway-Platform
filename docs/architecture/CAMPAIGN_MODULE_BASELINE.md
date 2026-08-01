# Campaign Module Baseline (Protected)

**Status:** Protected enterprise baseline — initiative closed  
**Closed:** 2026-08-01  
**Branch tip (IA Complete):** `31c5a030` on `develop`  
**Class:** Governance only — no further Campaign redesign without Critical usability + formal Product approval

---

## What is protected

The Campaign module is the approved implementation for future Thinkway operational work. The baseline includes:

| Pillar | Canonical reference |
|--------|---------------------|
| Campaign Information Architecture | [`CAMPAIGN_INFORMATION_ARCHITECTURE.md`](./CAMPAIGN_INFORMATION_ARCHITECTURE.md) |
| Campaign Workspace UI (Aurora) | [`CAMPAIGN_WORKSPACE_UI_FREEZE.md`](./CAMPAIGN_WORKSPACE_UI_FREEZE.md) · [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md) |
| Business Process Navigation | [`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) · `lib/business-process/` |
| Enterprise Tabs | `components/workspace/enterprise-tabs.tsx` · `app/styles/enterprise-tabs.css` (process-aware) |
| Financial Display Standard | [`FINANCIAL_DISPLAY_STANDARD.md`](./FINANCIAL_DISPLAY_STANDARD.md) · `lib/finance/currency-format.ts` |
| Deliverables selection model | [`DELIVERABLES_DOCUMENTATION_REPOSITORY.md`](./DELIVERABLES_DOCUMENTATION_REPOSITORY.md) · `documentation-editor-binding.ts` |
| Persistent Workspace Shell | Campaign chrome + Enterprise Tabs stay mounted; content body swaps |

**Product UX standards (platform inheritance):** [`PRODUCT_UX_STANDARDS.md`](./PRODUCT_UX_STANDARDS.md)  
**Accepted Low debt (non-blocking):** [`CAMPAIGN_MODULE_TECHNICAL_DEBT.md`](./CAMPAIGN_MODULE_TECHNICAL_DEBT.md)

---

## Extension rules (mandatory)

Future features **must extend** this architecture. They **must not redesign** it.

Applies to:

- Planning Board (Release 2.2a)
- Media Plan Copilot (Release 2.2b)
- Reporting Hub
- Notifications
- Enterprise Analytics
- Future Finance modules
- Vendor IO Enterprise Completion

### Rules

1. Integrate into the existing Campaign Workspace shell and Aurora design language.  
2. Extend **Business Process Navigation** — no new navigation philosophy or parallel tab/app systems.  
3. Use Enterprise Tabs (process-aware) for workspace process rails.  
4. Use the Financial Display Standard for all money presentation.  
5. Preserve Deliverables selection / upload-lock / Save·Discard·Cancel behavior.  
6. Keep campaign-level finance KPIs in the header (Finance workspace may repeat R/C/GP/Margin).  
7. Give each workspace a unique summary identity — do not reintroduce duplicate campaign KPIs everywhere.  
8. Never ship disabled primary actions for unreleased capabilities.  
9. Prefer functional delivery over presentation change.  
10. Include Platform Architecture Compliance (lifecycle · journeys · BPN reuse · no new nav).

**Exception:** Critical usability defect with formal Product approval to reopen scope.

---

## Next development priority (functional delivery)

Architecture and Campaign redesign work are **closed**. Capability delivery order:

1. **Planning Board Capability Spec** — [`../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`](../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md) → then Release 2.2a implementation  
2. **Media Plan Copilot** — Release 2.2b  
3. **Client Collaboration Capability**  
4. **Vendor Journey**  
5. **Reporting Hub**  
6. **Notifications**  
7. **Enterprise Analytics**

---

## Stable foundations (platform context)

Future releases should spend far less time on redesign and more on capabilities. Current stable foundations include:

- Enterprise Operations & Finance Architecture  
- Campaign Information Architecture  
- Campaign Workspace UI  
- Financial Display Standard  
- Enterprise Tabs  
- Client IO Enterprise  
- Vendor IO foundation  

---

## Initiative status

**Campaign Information Architecture initiative: CLOSED permanently.**

No further Campaign Workspace redesign unless a Critical usability issue is identified and formally approved.
