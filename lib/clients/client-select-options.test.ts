import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClientSelectOptions,
  dedupeClientsById,
  shouldShowClientLegalSubtitle,
} from "./client-select-options";

test("shouldShowClientLegalSubtitle is false when legal name matches name", () => {
  assert.equal(
    shouldShowClientLegalSubtitle("Mind Share Egypt LTD", "Mind Share Egypt LTD"),
    false
  );
  assert.equal(shouldShowClientLegalSubtitle("Acme", "ACME"), false);
});

test("shouldShowClientLegalSubtitle is true when legal name differs", () => {
  assert.equal(
    shouldShowClientLegalSubtitle("Acme", "Acme Holdings LLC"),
    true
  );
});

test("dedupeClientsById keeps first occurrence per id", () => {
  const deduped = dedupeClientsById([
    { id: "a", name: "One" },
    { id: "a", name: "Duplicate" },
    { id: "b", name: "Two" },
  ]);

  assert.deepEqual(deduped, [
    { id: "a", name: "One" },
    { id: "b", name: "Two" },
  ]);
});

test("buildClientSelectOptions dedupes and uses subtitle only when legal name differs", () => {
  const options = buildClientSelectOptions([
    {
      id: "1",
      name: "Mind Share Egypt LTD",
      legal_name: "Mind Share Egypt LTD",
    },
    {
      id: "1",
      name: "Mind Share Egypt LTD",
      legal_name: "Mind Share Egypt LTD",
    },
    {
      id: "2",
      name: "Acme",
      legal_name: "Acme Holdings LLC",
    },
  ]);

  assert.deepEqual(options, [
    { value: "1", label: "Mind Share Egypt LTD" },
    {
      value: "2",
      label: "Acme",
      description: "Acme Holdings LLC",
    },
  ]);
});
