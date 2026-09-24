# Collections corrections — 25 September 2026

This verification supersedes the original seven-section acceptance notes.

- Six tabs: dash, aging, overdue, stmt, fcast, record. Server rejects retired pay/payables links with notFound.
- Payable implementation preserved on remote branch codex/billing-payables-preserved at 353bb0b8; see billing-handoff.md for the Billing work owner and currency/due-date findings.
- Updated supplied fragment passes 23 direct-child grid checks across four track lists, including span-credit validation. Existing copied declaration identity checks remain enabled.
- Dashboard has two summary grids and zero .tw-ad nodes. Aging has one hidden/expandable .tw-ad per client.
- Five-client fixture: one visible in With balance, four hidden; All shows five. Live search tested.
- 100-client fixture: All shows 100 within a 420px scroll region (5580px content height). No page horizontal overflow at the tested 1280px viewport.
- Statement amounts are ranked within the selected presentation currency, never by adding currencies; foreign balances remain separate.
- Overdue and bucket percentages are computed from invoice balances. Regression includes 50% overdue and unknown dates.
- TypeScript and seven finance/data tests pass. Receipt recording and contact-history behavior retained; no financial records created in verification.
- Requested 1409px viewport check: browser reported 1410px including its rounding; page width matched, left pane was exactly 266px, and all visible two- and seven-track grids matched their child counts.
