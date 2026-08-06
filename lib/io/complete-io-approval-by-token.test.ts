import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseApproveRpcPayload } from "@/lib/io/complete-io-approval-by-token";

describe("parseApproveRpcPayload", () => {
  it("accepts jsonb payload", () => {
    assert.deepEqual(
      parseApproveRpcPayload({
        io_id: "11111111-1111-1111-1111-111111111111",
        already_approved: true,
      }),
      {
        io_id: "11111111-1111-1111-1111-111111111111",
        already_approved: true,
      }
    );
  });

  it("accepts legacy uuid string return", () => {
    assert.deepEqual(
      parseApproveRpcPayload("11111111-1111-1111-1111-111111111111"),
      {
        io_id: "11111111-1111-1111-1111-111111111111",
        already_approved: false,
      }
    );
  });
});
