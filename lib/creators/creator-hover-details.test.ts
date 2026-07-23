import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCollaborationsLine,
  formatCreatorRecencyLabel,
  resolveCreatorRecencyIso,
} from "./creator-hover-details";

test("formatCollaborationsLine pluralizes counts", () => {
  assert.equal(formatCollaborationsLine(11, 1), "11 collaborations · 1 with you");
  assert.equal(formatCollaborationsLine(1, 0), "1 collaboration · 0 with you");
});

test("formatCreatorRecencyLabel uses the most recent timestamp", () => {
  const enriched = new Date(Date.now() - 16 * 86_400_000).toISOString();
  const updated = new Date(Date.now() - 5 * 86_400_000).toISOString();
  assert.equal(resolveCreatorRecencyIso(enriched, updated), updated);
  assert.match(formatCreatorRecencyLabel(enriched, updated) ?? "", /5 days ago/);
});

test("formatCreatorRecencyLabel falls back to updated_at", () => {
  const recent = new Date(Date.now() - 86_400_000).toISOString();
  const label = formatCreatorRecencyLabel(null, recent);
  assert.match(label ?? "", /^Updated /);
});
