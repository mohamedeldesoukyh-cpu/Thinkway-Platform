import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeRichHtml, sanitizeSvgIconHtml } from "./sanitize-html";

test("sanitizeRichHtml strips script tags and event handlers", () => {
  const dirty =
    `<p>Hello</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a>`;
  const clean = sanitizeRichHtml(dirty);
  assert.match(clean, /Hello/);
  assert.doesNotMatch(clean, /script/i);
  assert.doesNotMatch(clean, /onerror/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /alert/);
});

test("sanitizeRichHtml strips svg/math and keeps safe formatting", () => {
  const dirty = `<p><strong>Terms</strong></p><svg onload="alert(1)"></svg><math></math>`;
  const clean = sanitizeRichHtml(dirty);
  assert.match(clean, /<strong>Terms<\/strong>/);
  assert.doesNotMatch(clean, /svg/i);
  assert.doesNotMatch(clean, /onload/i);
});

test("sanitizeRichHtml blocks protocol-relative and data URLs on anchors", () => {
  const dirty = `<a href="//evil.com">x</a><a href="data:text/html,hi">y</a>`;
  const clean = sanitizeRichHtml(dirty);
  assert.doesNotMatch(clean, /evil\.com/);
  assert.doesNotMatch(clean, /data:/i);
});

test("sanitizeSvgIconHtml allows static platform icon SVG", () => {
  const svg =
    `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#6B7280"/></svg>`;
  const clean = sanitizeSvgIconHtml(svg);
  assert.match(clean, /<svg/);
  assert.match(clean, /circle/);
  assert.doesNotMatch(clean, /script/i);
});

test("sanitizeSvgIconHtml strips script inside svg", () => {
  const dirty = `<svg><script>alert(1)</script><circle cx="1" cy="1" r="1"/></svg>`;
  const clean = sanitizeSvgIconHtml(dirty);
  assert.doesNotMatch(clean, /script/i);
  assert.doesNotMatch(clean, /alert/);
});
