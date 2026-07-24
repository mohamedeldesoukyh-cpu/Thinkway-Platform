import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_MEDIA_SRC_ALLOWLIST,
  SOCIAL_POST_ALLOWLIST,
  SOCIAL_PROFILE_ALLOWLIST,
  isBlockedSsrfHostname,
  isExactHostOrSuffix,
  isUrlAllowedByHostlist,
  parseSafeOutboundUrl,
  resolveRedirectLocation,
} from "./ssrf";

test("isExactHostOrSuffix rejects substring lookalikes", () => {
  assert.equal(
    isExactHostOrSuffix("notinstagram.com", { exact: [], suffixes: ["instagram.com"] }),
    false
  );
  assert.equal(
    isExactHostOrSuffix("evil-cdninstagram.com", {
      exact: [],
      suffixes: ["cdninstagram.com"],
    }),
    false
  );
  assert.equal(
    isExactHostOrSuffix("scontent.cdninstagram.com", {
      exact: [],
      suffixes: ["cdninstagram.com"],
    }),
    true
  );
  assert.equal(
    isExactHostOrSuffix("www.instagram.com", { exact: [], suffixes: ["instagram.com"] }),
    true
  );
});

test("isBlockedSsrfHostname covers private, loopback, link-local, metadata", () => {
  assert.equal(isBlockedSsrfHostname("localhost"), true);
  assert.equal(isBlockedSsrfHostname("127.0.0.1"), true);
  assert.equal(isBlockedSsrfHostname("10.1.2.3"), true);
  assert.equal(isBlockedSsrfHostname("172.16.0.1"), true);
  assert.equal(isBlockedSsrfHostname("172.31.255.1"), true);
  assert.equal(isBlockedSsrfHostname("172.32.0.1"), false);
  assert.equal(isBlockedSsrfHostname("192.168.1.10"), true);
  assert.equal(isBlockedSsrfHostname("169.254.169.254"), true);
  assert.equal(isBlockedSsrfHostname("::1"), true);
  assert.equal(isBlockedSsrfHostname("metadata.google.internal"), true);
  assert.equal(isBlockedSsrfHostname("scontent.cdninstagram.com"), false);
});

test("parseSafeOutboundUrl rejects credentials, http by default, and private hosts", () => {
  assert.equal(parseSafeOutboundUrl("http://www.instagram.com/x").ok, false);
  assert.equal(parseSafeOutboundUrl("https://user:pass@www.instagram.com/x").ok, false);
  assert.equal(parseSafeOutboundUrl("https://127.0.0.1/secret").ok, false);
  assert.equal(parseSafeOutboundUrl("https://169.254.169.254/latest/meta-data").ok, false);
  assert.equal(parseSafeOutboundUrl("https://www.instagram.com/p/abc/").ok, true);
});

test("social allowlists accept real CDNs and reject lookalikes", () => {
  assert.equal(
    isUrlAllowedByHostlist(
      "https://scontent.cdninstagram.com/v/t51.jpg",
      SOCIAL_MEDIA_SRC_ALLOWLIST
    ),
    true
  );
  assert.equal(
    isUrlAllowedByHostlist("https://notinstagram.com/v/t51.jpg", SOCIAL_MEDIA_SRC_ALLOWLIST),
    false
  );
  assert.equal(
    isUrlAllowedByHostlist("https://www.instagram.com/p/abc/", SOCIAL_POST_ALLOWLIST),
    true
  );
  assert.equal(
    isUrlAllowedByHostlist("https://www.tiktok.com/@creator", SOCIAL_PROFILE_ALLOWLIST),
    true
  );
  assert.equal(
    isUrlAllowedByHostlist("https://example.com/@creator", SOCIAL_PROFILE_ALLOWLIST),
    false
  );
});

test("resolveRedirectLocation builds absolute redirect targets", () => {
  assert.equal(
    resolveRedirectLocation("https://www.instagram.com/p/abc/", "/evil"),
    "https://www.instagram.com/evil"
  );
  assert.equal(
    resolveRedirectLocation(
      "https://www.instagram.com/p/abc/",
      "https://169.254.169.254/latest"
    ),
    "https://169.254.169.254/latest"
  );
});

test("redirect target to metadata host fails allowlist check", () => {
  const location = resolveRedirectLocation(
    "https://www.instagram.com/p/abc/",
    "https://169.254.169.254/latest/meta-data"
  );
  assert.ok(location);
  assert.equal(isUrlAllowedByHostlist(location!, SOCIAL_POST_ALLOWLIST), false);
});
