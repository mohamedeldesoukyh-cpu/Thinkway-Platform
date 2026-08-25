import assert from "node:assert/strict";
import { test } from "node:test";

import {
  headerPartnerIdentity,
  identityClientLabelCandidates,
  identityLookupLabels,
  parseIdentityLogo,
  preparedForClientLabel,
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

test("parseIdentityLogo keeps a name-only legal entity mark", () => {
  const parsed = parseIdentityLogo({
    url: "",
    source: "client",
    alt: "Bundle Plus Communication",
  });
  assert.equal(parsed?.source, "client");
  assert.equal(parsed?.url, "");
  assert.equal(parsed?.alt, "Bundle Plus Communication");
});

test("header partner identity never uses the brand or campaign title", () => {
  assert.equal(
    headerPartnerIdentity({
      identityLogo: null,
      clientLabel: "Cofftea Egypt",
      brandName: "Cofftea Egypt",
      campaignName: "Cofftea Egypt",
    }),
    null
  );
  assert.equal(
    headerPartnerIdentity({
      identityLogo: { url: "", source: "client", alt: "Cofftea Egypt" },
      clientLabel: "Cofftea Egypt",
      brandName: "Cofftea Egypt",
      campaignName: "Cofftea Egypt",
    }),
    null
  );
  assert.equal(
    preparedForClientLabel({
      clientLabel: "Cofftea Egypt",
      brandName: "Cofftea Egypt",
      campaignName: "Cofftea Egypt",
    }),
    undefined
  );
  assert.equal(
    headerPartnerIdentity({
      identityLogo: { url: "", source: "client", alt: "Bundle Plus Communication" },
      clientLabel: "Cofftea Egypt",
      brandName: "Cofftea Egypt",
      campaignName: "Cofftea Egypt",
    })?.alt,
    "Bundle Plus Communication"
  );
  assert.equal(
    headerPartnerIdentity({
      clientLabel: "Bundle Plus Communication",
      brandName: "Cofftea Egypt",
      campaignName: "Cofftea Egypt",
    })?.alt,
    "Bundle Plus Communication"
  );
});
