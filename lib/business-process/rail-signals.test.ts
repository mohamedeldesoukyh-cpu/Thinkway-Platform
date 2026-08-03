import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStageRailSignals } from "@/lib/business-process/rail-signals";
import type { BusinessProcessStageDefinition } from "@/lib/business-process/types";

const STAGES: readonly BusinessProcessStageDefinition<string>[] = [
  { id: "overview", label: "Overview", owner: "Operations" },
  { id: "lines", label: "Assignments", owner: "Operations" },
  { id: "billing", label: "Finance", owner: "Finance" },
];

describe("buildStageRailSignals", () => {
  it("STAB-033: completed signal marks every stage completed", () => {
    const signals = buildStageRailSignals(STAGES, "overview", "completed");
    assert.equal(signals.overview, "completed");
    assert.equal(signals.lines, "completed");
    assert.equal(signals.billing, "completed");
  });

  it("marks prior stages completed and later stages upcoming", () => {
    const signals = buildStageRailSignals(STAGES, "lines", "waiting_internal");
    assert.equal(signals.overview, "completed");
    assert.equal(signals.lines, "waiting_internal");
    assert.equal(signals.billing, "upcoming");
  });
});
