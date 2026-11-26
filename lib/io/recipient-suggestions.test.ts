import assert from "node:assert/strict";
import { test } from "node:test";
import { uniqueRecipientSuggestions } from "./recipient-suggestions";

test("deduplicates saved addresses without losing names or combining different people with the same name", () => {
  assert.deepEqual(uniqueRecipientSuggestions([
    { name: "", email: "Person@example.com" },
    { name: "Dana", email: " person@example.com " },
    { name: "Dana", email: "another@example.com" },
    { name: "Broken", email: "invalid" },
  ]), [
    { name: "Dana", email: "person@example.com" },
    { name: "Dana", email: "another@example.com" },
  ]);
});
