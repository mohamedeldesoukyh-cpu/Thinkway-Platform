import assert from "node:assert/strict";
import { test } from "node:test";

import {
  identityClientLabelCandidates,
  identityLookupLabels,
  parseIdentityLogo,
  uniqueIdentityClientIds,
} from "./identity-logo";

test("identity lookup labels skip the brand name so Cofftea Egypt is not treated as the client", () => {
  assert.deepEqual(identityLookupLabels("Cofftea Egypt", "Cofftea Egypt"), []);
  assert.deepEqual(identityLookupLabels("Bundle Plus Communication", "Cofftea Egypt"), [
    "Bundle Plus Communication",
  ]);
});

test("unique identity client ids keep first occurrence and drop blanks", () => {
  assert.deepEqual(
    uniqueIdentityClientIds([" a ", "", null, "a", "b", undefined, "b"]),
    ["a", "b"]
  );
});

test("identity client labels keep first casing and skip empty values", () => {
  assert.deepEqual(
    identityClientLabelCandidates([
      "  Bundle Plus Communication  ",
      null,
      "bundle plus communication",
      "CIT-000003",
    ]),
    ["Bundle Plus Communication", "CIT-000003"]
  );
});

test("parseIdentityLogo accepts client source after a live overlay", () => {
  const parsed = parseIdentityLogo({
    url: "https://cdn.example/client.png",
    source: "client",
    alt: "Bundle Plus Communication",
  });
  assert.equal(parsed?.source, "client");
  assert.equal(parsed?.url, "https://cdn.example/client.png");
  assert.equal(parsed?.alt, "Bundle Plus Communication");
});
