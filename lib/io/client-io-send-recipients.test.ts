import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyRecipientEmailEdit,
  parseSendRecipientsJson,
  serializeSendRecipients,
  splitRecipientEmails,
} from "@/lib/io/client-io-send-recipients";

describe("client-io-send-recipients", () => {
  it("splits pasted multi-email blobs", () => {
    assert.deepEqual(
      splitRecipientEmails("a@x.com, b@y.com; c@z.com\nd@w.com"),
      ["a@x.com", "b@y.com", "c@z.com", "d@w.com"]
    );
  });

  it("expands a multi-email field edit into rows", () => {
    const next = applyRecipientEmailEdit(
      [{ name: "Dana", email: "" }],
      0,
      "dana@x.com, amir@y.com"
    );
    assert.deepEqual(next, [
      { name: "Dana", email: "dana@x.com" },
      { name: "", email: "amir@y.com" },
    ]);
  });

  it("parses and serializes multiple recipients for send", () => {
    const parsed = parseSendRecipientsJson([
      { name: "A", email: "a@x.com" },
      { name: "B", email: "b@y.com, c@z.com" },
      { name: "Dup", email: "a@x.com" },
    ]);
    assert.deepEqual(parsed, [
      { name: "A", email: "a@x.com" },
      { name: "B", email: "b@y.com" },
      { name: "", email: "c@z.com" },
    ]);
    const json = serializeSendRecipients(parsed);
    assert.deepEqual(JSON.parse(json), [
      { name: "A", email: "a@x.com" },
      { name: "B", email: "b@y.com" },
      { name: "", email: "c@z.com" },
    ]);
  });
});
