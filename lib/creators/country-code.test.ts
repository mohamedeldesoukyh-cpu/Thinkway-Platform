import { strict as assert } from "node:assert";
import { test } from "node:test";

import { resolveCountryCode } from "./country-code";

test("resolves country names and codes to canonical ISO-2", () => {
  assert.equal(resolveCountryCode("EG"), "EG");
  assert.equal(resolveCountryCode("Egypt"), "EG");
  assert.equal(resolveCountryCode("EGYPT"), "EG");
  assert.equal(resolveCountryCode("egypt"), "EG");
  assert.equal(resolveCountryCode("Arab Republic of Egypt"), "EG");
  assert.equal(resolveCountryCode("AE"), "AE");
  assert.equal(resolveCountryCode("United Arab Emirates"), "AE");
});

test("resolves aliases to canonical ISO-2", () => {
  assert.equal(resolveCountryCode("uae"), "AE");
  assert.equal(resolveCountryCode("dubai"), "AE");
  assert.equal(resolveCountryCode("ksa"), "SA");
  assert.equal(resolveCountryCode("saudi"), "SA");
  assert.equal(resolveCountryCode("Saudi Arabia"), "SA");
});

test("is idempotent for valid codes", () => {
  for (const code of ["EG", "AE", "SA", "US", "GB"]) {
    assert.equal(resolveCountryCode(code), code);
    assert.equal(resolveCountryCode(resolveCountryCode(code)), code);
  }
});

test("unknown values pass through unchanged (uppercased); empty stays empty", () => {
  assert.equal(resolveCountryCode("Narnia"), "NARNIA");
  assert.equal(resolveCountryCode("zz"), "ZZ");
  assert.equal(resolveCountryCode(""), "");
  assert.equal(resolveCountryCode(null), "");
  assert.equal(resolveCountryCode(undefined), "");
});
