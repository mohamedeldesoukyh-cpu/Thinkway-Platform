import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyRecipientEmailEdit,
  parseSendRecipientsJson,
  serializeSendRecipients,
  splitRecipientEmails,
  clientIoDeliveryRecipients,
  validateClientIoRecipients,
  seedRecipientsFromContacts,
  clientIoDocumentRecipients,
} from "@/lib/io/client-io-send-recipients";

describe("client-io-send-recipients", () => {
  it("saves Main independently of TO/CC/BCC and hides Others from the document", () => {
    const recipients = parseSendRecipientsJson(JSON.parse(serializeSendRecipients([
      { name: "Delivery", email: "delivery@example.com", role: "to", documentRole: "other" },
      { name: "Document contact", email: "main@example.com", role: "cc", documentRole: "main" },
      { name: "Private", email: "private@example.com", role: "bcc", documentRole: "other" },
    ])));
    assert.deepEqual(clientIoDocumentRecipients(recipients).map(r => r.email), ["main@example.com"]);
    assert.deepEqual(clientIoDeliveryRecipients(recipients).to.map(r => r.email), ["delivery@example.com"]);
    assert.deepEqual(clientIoDocumentRecipients([{ name: "No header", email: "a@example.com", documentRole: "other" }]), []);
  });
  it("preserves recipient roles through save and reload, including pasted CC rows", () => {
    const rows = applyRecipientEmailEdit([{ name: "Client", email: "", role: "cc" }], 0, "a@example.com,b@example.com");
    assert.deepEqual(rows.map(r => r.role), ["cc", "cc"]);
    assert.deepEqual(parseSendRecipientsJson(JSON.parse(serializeSendRecipients(rows))), rows);
  });

  it("adds automatic blind copies once and keeps them out of TO and CC", () => {
    const groups = clientIoDeliveryRecipients([
      { name: "Client", email: "client@example.com" },
      { name: "Copy", email: "copy@example.com", role: "cc" },
      { name: "Sender", email: "SENDER@example.com", role: "bcc" },
    ], "sender@example.com");
    assert.deepEqual(groups.to.map(r => r.email), ["client@example.com"]);
    assert.deepEqual(groups.cc.map(r => r.email), ["copy@example.com"]);
    assert.deepEqual(groups.bcc.map(r => r.email), ["SENDER@example.com", "traffic@thinkwaymedia.com"]);
  });

  it("allows saving an empty list without reseeding contacts and rejects invalid or duplicate entries", () => {
    assert.equal(validateClientIoRecipients("[]"), null);
    assert.deepEqual(seedRecipientsFromContacts([], [{ label: "Old", email: "old@example.com" }], true), []);
    assert.ok(validateClientIoRecipients(serializeSendRecipients([{ name: "New", email: "" }])));
    assert.ok(validateClientIoRecipients('[{"email":"bad"},{"email":"valid@example.com"}]'));
    assert.ok(validateClientIoRecipients('[{"email":"a@example.com"},{"email":"A@example.com","role":"cc"}]'));
    assert.ok(validateClientIoRecipients('[{"email":"a@example.com","name":"Injected\\r\\nBcc: bad@example.com"}]'));
  });
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
