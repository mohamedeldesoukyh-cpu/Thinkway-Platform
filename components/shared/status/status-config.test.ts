import assert from "node:assert/strict";

import {
  CAMPAIGN_ASSIGNMENT_STATUS_TONE,
  CAMPAIGN_STATUS_TONE,
  CLIENT_STATUS_TONE,
  COLLECTION_STATUS_TONE,
  ONBOARDING_STATUS_TONE,
  OPERATIONAL_STATUS_TONE,
  STATUS_TONE_MAPS,
} from "./status-config";
import {
  buildToneClassMap,
  formatPortalStatusLabel,
  normalizeLegacyTone,
  normalizePortalStatusKey,
  resolveStatusBadgeClassName,
  resolveStatusTone,
} from "./status-utils";

// Domain maps are populated for every registered domain
assert.equal(Object.keys(STATUS_TONE_MAPS).length, 24);

// Semantic token classes — no hardcoded palette colors
const outlineSuccess = resolveStatusBadgeClassName("success", "outline");
assert.match(outlineSuccess, /success/);
assert.doesNotMatch(outlineSuccess, /emerald-|blue-|amber-/);

const pillWarning = resolveStatusBadgeClassName("warning", "pill");
assert.match(pillWarning, /warning/);

// Legacy tone normalization
assert.equal(normalizeLegacyTone("info"), "foreground");
assert.equal(normalizeLegacyTone("accent"), "foreground");
assert.equal(normalizeLegacyTone("danger"), "destructive");
assert.equal(normalizeLegacyTone("success"), "success");

// resolveStatusTone fallbacks
assert.equal(resolveStatusTone("client", "active"), "success");
assert.equal(resolveStatusTone("client", "unknown_status"), "neutral");
assert.equal(resolveStatusTone("campaign", "cancelled"), "destructive");
assert.equal(resolveStatusTone("onboarding", "legal_pending"), "warning");

// Operational + billing hierarchy tones preserved
assert.equal(OPERATIONAL_STATUS_TONE.invoiced, "success");
assert.equal(OPERATIONAL_STATUS_TONE.reopened, "warning");
assert.equal(CAMPAIGN_ASSIGNMENT_STATUS_TONE.paid, "success");
assert.equal(COLLECTION_STATUS_TONE.overdue, "destructive");

// Client + onboarding alignment
assert.equal(CLIENT_STATUS_TONE.active, "success");
assert.equal(ONBOARDING_STATUS_TONE.ready, "success");
assert.equal(CAMPAIGN_STATUS_TONE.paused, "warning");

// Portal label helpers
assert.equal(normalizePortalStatusKey(undefined), "pending");
assert.equal(formatPortalStatusLabel("partially paid"), "Partially paid");

// buildToneClassMap produces class strings for all keys
const operationalClasses = buildToneClassMap(OPERATIONAL_STATUS_TONE, "pill");
assert.equal(Object.keys(operationalClasses).length, Object.keys(OPERATIONAL_STATUS_TONE).length);
assert.match(operationalClasses.draft, /muted-foreground/);

console.log("status-config.test.ts: all assertions passed");
