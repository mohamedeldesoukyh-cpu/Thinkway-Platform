import { describe, expect, it } from "vitest";

import {
  mergePastedNumericText,
  parseDecimalInput,
  sanitizeNumericInput,
} from "./quotation-numeric-input";

describe("sanitizeNumericInput", () => {
  it("removes currency symbols and codes", () => {
    expect(sanitizeNumericInput("$5,000")).toBe("5000");
    expect(sanitizeNumericInput("EGP 1,234.50")).toBe("1234.50");
    expect(sanitizeNumericInput("€100")).toBe("100");
    expect(sanitizeNumericInput("1,234.56 USD")).toBe("1234.56");
    expect(sanitizeNumericInput("SAR 5,000")).toBe("5000");
    expect(sanitizeNumericInput("£1,200.00")).toBe("1200.00");
    expect(sanitizeNumericInput("US$2,500")).toBe("2500");
  });
});

describe("parseDecimalInput", () => {
  it("parses sanitized currency strings", () => {
    expect(parseDecimalInput("EGP 12,500")).toBe(12500);
    expect(parseDecimalInput("$99.99")).toBe(99.99);
  });
});

describe("mergePastedNumericText", () => {
  it("replaces selection with sanitized paste", () => {
    expect(mergePastedNumericText("100", "EGP 2,500", 0, 3)).toBe("2500");
  });
});
