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
| Enterprise Tabs | `components/workspace/enterprise-tabs.tsx` · `app/styles/enterprise-tabs.css` |
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
2. Use Enterprise Tabs for workspace navigation — no parallel tab systems.  
3. Use the Financial Display Standard for all money presentation.  
4. Preserve Deliverables selection / upload-lock / Save·Discard·Cancel behavior.  
5. Keep campaign-level finance KPIs in the header (Finance workspace may repeat R/C/GP/Margin).  
6. Give each workspace a unique summary identity — do not reintroduce duplicate campaign KPIs everywhere.  
7. Never ship disabled primary actions for unreleased capabilities.  
8. Prefer functional delivery over presentation change.

**Exception:** Critical usability defect with formal Product approval to reopen scope.

---

## Next development priority (functional delivery)

Campaign redesign work is **closed**. Return to capability delivery in this order:

1. **Planning Board** — Release 2.2a  
2. **Media Plan Copilot** — Release 2.2b  
3. **Vendor IO Enterprise Completion**  
4. **Reporting Hub**  
5. **Notifications**  
6. **Enterprise Analytics**

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
