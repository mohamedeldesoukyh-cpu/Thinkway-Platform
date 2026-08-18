# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Client Workspace engagement % display — **releasing to Production**

Client Workspace treated ER values in (0, 1] as 0–1 fractions and multiplied by 100. Platform stores ER as a percent (`0.9` = 0.9%), so Instagram `0.903` rendered as **90.3%** while the Average badge/meter used the raw value. Rates above 100 (e.g. `193.4`) are treated as a percent multiplied twice.

Fix: `normalizeClientEngagementRate` in `features/client-workspace/format.ts` — used by list chips, creator card, badge, and meter. No database changes.

- Dev: https://dev.thinkwaymedia.com  
- Prod: https://app.thinkwaymedia.com  
- No database changes
