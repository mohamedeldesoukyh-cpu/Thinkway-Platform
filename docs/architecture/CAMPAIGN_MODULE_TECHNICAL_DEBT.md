# Campaign Module — Technical Debt Register (Low)

**Status:** Enhancement backlog only  
**Created:** 2026-08-01  
**Baseline:** [`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)

These items were accepted during the Enterprise UX Validation Pass.  
They **must not block** Planning Board, Copilot, or other functional releases.

---

## Backlog

| ID | Item | Priority | Trigger / when to address | Notes |
|----|------|----------|---------------------------|-------|
| TD-CAMP-01 | **Outstanding vs Receivable separation** | Low | When Accounts Receivable aging is implemented in Finance | Today both Finance summary labels read from `billing_outstanding`. Split only when distinct AR fields/rules exist. |
| TD-CAMP-02 | **Timeline Notifications metric** | Low | When the platform notification service / inbox exists | Timeline summary currently shows `—` for Notifications. Wire a real count; do not fabricate. |
| TD-CAMP-03 | **Optional sticky Campaign identity on scroll** | Low | Optional UX polish after functional releases | Chrome scrolls away; Enterprise Tabs pin. Optional: pin identity strip while scrolling within a workspace. Not required for IA completeness. |
| TD-CAMP-04 | **ETL currency formatter alignment** | Low | Next intelligence/ETL maintenance pass | `scripts/intelligence-etl/*` still use `Intl` `style: "currency"`. Align to Financial Display Standard when touching those scripts. Non-product UI. |

---

## Explicitly out of scope for this register

- Campaign Workspace redesign  
- New navigation systems  
- Changes to Deliverables selection model  
- Changes to Financial Display Standard rules (unless Product reopens)  
- Any High/Critical debt from other initiatives (track elsewhere)

---

## Process

1. Pull items into a release only when the trigger capability is being built.  
2. Keep fixes presentation/data-wiring scoped — no opportunistic redesign.  
3. Close items here when shipped; do not expand the Campaign baseline.
