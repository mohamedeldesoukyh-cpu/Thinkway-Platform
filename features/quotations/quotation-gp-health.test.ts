import assert from "node:assert/strict";

import { resolveGpHealthTone } from "@/features/quotations/quotation-gp-health";

assert.equal(resolveGpHealthTone({ gpValueEgp: 100, gpPct: 30 }), "success");
assert.equal(resolveGpHealthTone({ gpValueEgp: 100, gpPct: 25 }), "success");
assert.equal(resolveGpHealthTone({ gpValueEgp: 100, gpPct: 20 }), "warning");
assert.equal(resolveGpHealthTone({ gpValueEgp: 100, gpPct: 15 }), "warning");
assert.equal(resolveGpHealthTone({ gpValueEgp: 100, gpPct: 14.9 }), "danger");
assert.equal(resolveGpHealthTone({ gpValueEgp: -1, gpPct: 50 }), "danger");

console.log("quotation-gp-health.test.ts passed");
