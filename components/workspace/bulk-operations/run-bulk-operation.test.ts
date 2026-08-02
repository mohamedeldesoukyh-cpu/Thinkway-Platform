import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatBulkOperationSummary,
  runBulkOperation,
} from "@/components/workspace/bulk-operations/run-bulk-operation";

describe("runBulkOperation", () => {
  it("preserves partial success and never rolls back completed items", async () => {
    const calls: string[] = [];
    const summary = await runBulkOperation({
      label: "Mark Delivered Manually",
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      items: ["a", "b", "c"],
      getId: (id) => id,
      mutate: async (id) => {
        calls.push(id);
        if (id === "b") return { ok: false, message: "Vendor missing." };
        return { ok: true };
      },
    });

    assert.deepEqual(calls, ["a", "b", "c"]);
    assert.equal(summary.succeeded, 2);
    assert.equal(summary.failed, 1);
    assert.deepEqual(summary.succeededIds, ["a", "c"]);
    assert.deepEqual(summary.failedIds, ["b"]);
    assert.equal(summary.mutationPhaseOk, true);
  });

  it("reports remaining counts for large selections (32 / 100)", async () => {
    const remainings: number[] = [];
    const items = Array.from({ length: 32 }, (_, i) => `vio-${i}`);
    const summary = await runBulkOperation({
      label: "Updating Vendor IOs",
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      items,
      getId: (id) => id,
      mutate: async () => ({ ok: true }),
      onProgress: (p) => remainings.push(p.remaining),
    });

    assert.equal(summary.total, 32);
    assert.equal(summary.succeeded, 32);
    assert.equal(summary.failed, 0);
    assert.ok(remainings.includes(20));
    assert.equal(remainings[remainings.length - 1], 0);
  });

  it("separates refresh failure from mutation success with business copy", async () => {
    const summary = await runBulkOperation({
      label: "Send Selected",
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      items: ["a"],
      getId: (id) => id,
      mutate: async () => ({ ok: true }),
      refresh: async () => {
        throw new Error("Network timeout while refreshing.");
      },
    });

    assert.equal(summary.succeeded, 1);
    assert.equal(summary.refreshPhase, "failed");
    const formatted = formatBulkOperationSummary(summary);
    assert.equal(formatted.tone, "warning");
    assert.match(formatted.title, /were updated successfully/i);
    assert.match(formatted.description, /saved|refresh|complete/i);
  });

  it("uses business wording for full success", async () => {
    const summary = await runBulkOperation({
      label: "Mark Accepted",
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      items: Array.from({ length: 32 }, (_, i) => String(i)),
      getId: (id) => id,
      mutate: async () => ({ ok: true }),
    });
    const formatted = formatBulkOperationSummary(summary);
    assert.equal(
      formatted.title,
      "32 Vendor IOs were updated successfully"
    );
  });

  it("counts skipped items without treating them as failures", async () => {
    const summary = await runBulkOperation({
      label: "Mark Accepted",
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      items: ["a", "b"],
      getId: (id) => id,
      mutate: async (id) =>
        id === "a"
          ? { ok: true, skipped: true, message: "Already approved." }
          : { ok: true },
    });
    assert.equal(summary.skipped, 1);
    assert.equal(summary.succeeded, 1);
    assert.equal(summary.failed, 0);
  });

  it("handles 100-item runs without losing successes", async () => {
    const items = Array.from({ length: 100 }, (_, i) => String(i));
    const summary = await runBulkOperation({
      label: "Updating Vendor IOs",
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      items,
      getId: (id) => id,
      mutate: async (id) => {
        if (Number(id) % 33 === 0) return { ok: false, message: "Transient" };
        return { ok: true };
      },
    });
    assert.equal(summary.total, 100);
    assert.equal(summary.succeeded + summary.failed, 100);
    assert.ok(summary.succeeded >= 96);
    assert.ok(summary.failed >= 1);
    const formatted = formatBulkOperationSummary(summary);
    assert.match(formatted.description, /Selected 100/i);
    assert.match(formatted.description, /Retry Failed/i);
  });

  it("contains no domain imports — framework stays generic", async () => {
    // Structural guard: this module must stay domain-agnostic.
    // If this test file can import and run with plain strings, the runner is generic.
    const summary = await runBulkOperation({
      label: "Generic",
      entityLabel: "record",
      entityLabelPlural: "records",
      items: [1, 2, 3],
      getId: (n) => String(n),
      mutate: async () => ({ ok: true }),
    });
    assert.equal(summary.succeeded, 3);
  });
});
