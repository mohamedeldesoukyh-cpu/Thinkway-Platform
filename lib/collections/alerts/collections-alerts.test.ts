import assert from "node:assert/strict";
import { buildCollectionsAlerts } from "./collections-alerts";
import type { AgingSummary } from "../aging";

const aging: AgingSummary = {
  invoice_count: 5, total_outstanding: 500, overdue_amount: 200, current_amount: 300,
  buckets: [
    { bucket: "current", label: "Current", count: 3, amount: 300 },
    { bucket: "1_30", label: "1–30 days", count: 1, amount: 100 },
    { bucket: "90_plus", label: "90+ days", count: 1, amount: 100 },
  ],
};
const alerts = buildCollectionsAlerts({ invoices: [], aging, globalOutstanding: 500 }).alerts;
assert.equal(alerts.find(a => a.id === "overdue-total")?.description, "2 open invoice(s) with past-due balances.");
assert.equal(alerts.find(a => a.id === "aging-escalation")?.description, "1 invoice(s) in 90+ day bucket.");
assert.equal(alerts.some(a => a.id === "cashflow-risk"), false, "Exactly 40% is not over 40%");
assert.equal(buildCollectionsAlerts({ invoices: [], aging: {...aging, overdue_amount: 0}, globalOutstanding: 500 }).alerts.some(a => a.id === "overdue-total"), false);
console.log("collections-alerts.test.ts passed");
