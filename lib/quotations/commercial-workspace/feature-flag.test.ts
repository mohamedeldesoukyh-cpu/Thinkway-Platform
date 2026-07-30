import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isQuotationCommercialWorkspaceEnabled } from "./feature-flag";

describe("isQuotationCommercialWorkspaceEnabled", () => {
  const keys = [
    "QUOTATION_COMMERCIAL_WORKSPACE",
    "NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE",
    "THINKWAY_ENV",
    "VERCEL_ENV",
    "NEXT_PUBLIC_VERCEL_ENV",
  ] as const;
  const previous = new Map<string, string | undefined>();

  afterEach(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
  });

  function stash(key: (typeof keys)[number], value: string | undefined) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("respects explicit off even on development", () => {
    stash("QUOTATION_COMMERCIAL_WORKSPACE", "false");
    stash("THINKWAY_ENV", "development");
    assert.equal(isQuotationCommercialWorkspaceEnabled(), false);
  });

  it("respects explicit on even on production", () => {
    stash("NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE", "true");
    stash("THINKWAY_ENV", "production");
    assert.equal(isQuotationCommercialWorkspaceEnabled(), true);
  });

  it("defaults ON for development when unset", () => {
    for (const key of keys) stash(key, undefined);
    stash("THINKWAY_ENV", "development");
    assert.equal(isQuotationCommercialWorkspaceEnabled(), true);
  });

  it("defaults OFF for production when unset", () => {
    for (const key of keys) stash(key, undefined);
    stash("THINKWAY_ENV", "production");
    assert.equal(isQuotationCommercialWorkspaceEnabled(), false);
  });
});
