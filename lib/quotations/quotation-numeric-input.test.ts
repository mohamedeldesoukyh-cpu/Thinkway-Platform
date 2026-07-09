import assert from "node:assert/strict";
import test from "node:test";

import {
  mergePastedNumericText,
  parseDecimalInput,
  sanitizeNumericInput,
} from "./quotation-numeric-input";

test("sanitizeNumericInput removes currency symbols and codes", () => {
  assert.equal(sanitizeNumericInput("$5,000"), "5000");
  assert.equal(sanitizeNumericInput("EGP 1,234.50"), "1234.50");
  assert.equal(sanitizeNumericInput("€100"), "100");
  assert.equal(sanitizeNumericInput("1,234.56 USD"), "1234.56");
  assert.equal(sanitizeNumericInput("SAR 5,000"), "5000");
  assert.equal(sanitizeNumericInput("£1,200.00"), "1200.00");
  assert.equal(sanitizeNumericInput("US$2,500"), "2500");
});

test("parseDecimalInput parses sanitized currency strings", () => {
  assert.equal(parseDecimalInput("EGP 12,500"), 12500);
  assert.equal(parseDecimalInput("$99.99"), 99.99);
});

test("mergePastedNumericText replaces selection with sanitized paste", () => {
  assert.equal(mergePastedNumericText("100", "EGP 2,500", 0, 3), "2500");
});
