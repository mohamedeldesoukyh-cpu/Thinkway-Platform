import assert from "node:assert/strict";
import { test } from "node:test";
import { notifyShortlistEvent, type ShortlistNotificationEvent } from "./notifications";

test("selection updates and change requests do not produce approval notifications", async () => {
  for (const [event, title] of [
    ["client_selection_updated", "Client selection updated"],
    ["client_changes_requested", "Client requested changes"],
    ["client_quotation_approved", "Client approved quotation"],
  ] as Array<[ShortlistNotificationEvent, string]>) {
    let rows: Array<{ title: string; event: string }> = [];
    const client = { from: () => ({ insert: async (value: typeof rows) => { rows = value; return { error: null }; } }) };
    await notifyShortlistEvent(client as never, { shortlistId: "shortlist", actorId: "actor", recipientIds: ["owner"], event });
    assert.equal(rows[0].title, title);
    assert.equal(rows[0].event, event);
  }
});
