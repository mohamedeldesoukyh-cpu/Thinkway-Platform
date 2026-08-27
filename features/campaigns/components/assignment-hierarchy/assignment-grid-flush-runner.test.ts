import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignmentGridSaveErrorMessage,
  runAssignmentGridFlushes,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-flush-runner";

const protocolError = new Error(
  "An unexpected response was received from the server."
);

describe("runAssignmentGridFlushes", () => {
  it("runs flushes one after another", async () => {
    const order: number[] = [];
    const results = await runAssignmentGridFlushes([
      async () => {
        order.push(1);
        await Promise.resolve();
        order.push(2);
        return { ok: true };
      },
      async () => {
        order.push(3);
        return { ok: true };
      },
    ]);

    assert.deepEqual(order, [1, 2, 3]);
    assert.deepEqual(results, [{ ok: true }, { ok: true }]);
  });

  it("retries a protocol decode error once", async () => {
    let attempts = 0;
    const results = await runAssignmentGridFlushes([
      async () => {
        attempts += 1;
        if (attempts === 1) throw protocolError;
        return { ok: true };
      },
    ]);

    assert.equal(attempts, 2);
    assert.deepEqual(results, [{ ok: true }]);
  });

  it("maps a repeated protocol error to a retryable save message", async () => {
    const results = await runAssignmentGridFlushes([
      async () => {
        throw protocolError;
      },
    ]);

    assert.deepEqual(results, [
      {
        ok: false,
        message: "Could not save this row. Wait a moment and click Save again.",
      },
    ]);
  });
});

describe("assignmentGridSaveErrorMessage", () => {
  it("summarizes multiple row failures", () => {
    assert.equal(
      assignmentGridSaveErrorMessage([
        { message: "Could not save this row. Wait a moment and click Save again." },
        { message: "Could not save this row. Wait a moment and click Save again." },
      ]),
      "2 rows failed to save. Could not save this row. Wait a moment and click Save again."
    );
  });
});
