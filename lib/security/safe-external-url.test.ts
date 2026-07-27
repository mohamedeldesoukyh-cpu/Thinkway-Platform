import assert from "node:assert/strict";
import test from "node:test";

import {
  isSafeExternalUrl,
  parseOptionalSafeExternalUrl,
  parseSafeExternalUrl,
  toSafeHref,
} from "./safe-external-url";

test("accepts valid HTTPS URLs and normalizes", () => {
  const result = parseSafeExternalUrl("  https://Example.COM/path?q=1  ");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, "https://example.com/path?q=1");
  }
});

test("rejects unsafe schemes", () => {
  const payloads = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
    "about:blank",
    "chrome://settings",
    "chrome-extension://abcd/page.html",
  ];
  for (const payload of payloads) {
    const result = parseSafeExternalUrl(payload);
    assert.equal(result.ok, false, `expected reject: ${payload}`);
  }
});

test("rejects encoded javascript payloads", () => {
  assert.equal(parseSafeExternalUrl("javascript%3Aalert(1)").ok, false);
  assert.equal(parseSafeExternalUrl("java%09script%3Aalert(1)").ok, false);
  assert.equal(
    parseSafeExternalUrl("  java%0ascript:alert(1)  ").ok,
    false
  );
});

test("rejects relative URLs", () => {
  assert.equal(parseSafeExternalUrl("/relative/path").ok, false);
  assert.equal(parseSafeExternalUrl("./local").ok, false);
  assert.equal(parseSafeExternalUrl("../escape").ok, false);
  assert.equal(parseSafeExternalUrl("//evil.example/path").ok, false);
  assert.equal(parseSafeExternalUrl("example.com/path").ok, false);
});

test("http rejected by default; allowed when opted in", () => {
  assert.equal(parseSafeExternalUrl("http://example.com").ok, false);
  const allowed = parseSafeExternalUrl("http://example.com", { allowHttp: true });
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.url, "http://example.com/");
});

test("promoteBareDomain enables https promotion", () => {
  const result = parseSafeExternalUrl("www.brand.com/about", {
    promoteBareDomain: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.url, "https://www.brand.com/about");
});

test("optional empty succeeds as null", () => {
  const empty = parseOptionalSafeExternalUrl("   ");
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.url, null);

  const bad = parseOptionalSafeExternalUrl("javascript:alert(1)");
  assert.equal(bad.ok, false);
});

test("toSafeHref blocks unsafe and storage-like values", () => {
  assert.equal(toSafeHref("https://safe.example/a"), "https://safe.example/a");
  assert.equal(toSafeHref("javascript:alert(1)"), null);
  assert.equal(toSafeHref("storage://influencer-documents/x"), null);
  assert.equal(toSafeHref(null), null);
});

test("mailto only when allowed", () => {
  assert.equal(parseSafeExternalUrl("mailto:a@b.com").ok, false);
  const ok = parseSafeExternalUrl("mailto:a@b.com", { allowMailto: true });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.url, "mailto:a@b.com");
});

test("isSafeExternalUrl mirrors parse", () => {
  assert.equal(isSafeExternalUrl("https://ok.example"), true);
  assert.equal(isSafeExternalUrl("javascript:1"), false);
});
