import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildClientIoMilestoneTemplate,
  formatClientIoMilestonesPaymentSchedule,
  isClientIoMilestoneEditable,
  validateClientIoMilestones,
} from "./client-io-milestones";

test("templates total 100%", () => {
  for (const templateId of [
    "approval_100",
    "net_30",
    "net_60",
    "net_90",
    "fifty_fifty",
    "monthly_3",
    "completion_100",
  ] as const) {
    const rows = buildClientIoMilestoneTemplate(templateId);
    const result = validateClientIoMilestones(rows);
    assert.equal(result.ok, true, templateId);
    if (result.ok) {
      assert.equal(Math.round(result.totalPercent), 100, templateId);
    }
  }
});

test("validation rejects totals other than 100%", () => {
  const result = validateClientIoMilestones([
    {
      label: "Partial",
      milestoneKind: "custom",
      percent: 40,
      dueTrigger: "on_approval",
      dueOffsetDays: 0,
      dueDate: null,
      notes: null,
      sortOrder: 1,
    },
  ]);
  assert.equal(result.ok, false);
});

test("validation rejects negative percent", () => {
  const result = validateClientIoMilestones([
    {
      label: "Bad",
      milestoneKind: "custom",
      percent: -5,
      dueTrigger: "custom",
      dueOffsetDays: null,
      dueDate: null,
      notes: null,
      sortOrder: 1,
    },
  ]);
  assert.equal(result.ok, false);
});

test("empty milestones are allowed", () => {
  const result = validateClientIoMilestones([]);
  assert.equal(result.ok, true);
});

test("milestones editable only on draft/generated tip", () => {
  assert.equal(isClientIoMilestoneEditable("draft"), true);
  assert.equal(isClientIoMilestoneEditable("generated"), true);
  assert.equal(isClientIoMilestoneEditable("under_client_review"), false);
  assert.equal(isClientIoMilestoneEditable("approved", true), false);
});

test("payment schedule formatter is client-safe for net days", () => {
  const text = formatClientIoMilestonesPaymentSchedule(
    buildClientIoMilestoneTemplate("net_60")
  );
  assert.equal(
    text,
    "Net 60 Days — Payment due within 60 days of Client IO approval / invoice."
  );
  assert.ok(!text?.includes("1."));
  assert.ok(!text?.startsWith("100%"));
});

test("payment schedule formatter includes split percent for multi-milestone", () => {
  const text = formatClientIoMilestonesPaymentSchedule(
    buildClientIoMilestoneTemplate("fifty_fifty")
  );
  assert.ok(text?.includes("50%"));
  assert.ok(text?.includes("On kickoff"));
  assert.ok(!text?.includes("1."));
});
