import assert from "node:assert/strict";

import {
  normalizeIoTermsText,
  parseTermsText,
  resolveEffectiveVendorIoTerms,
  resolveDefaultTermsForVendor,
  resolveIoTermsSource,
  serializeTermsText,
} from "./client-io-terms";
import { VENDOR_IO_DEFAULT_TERMS } from "./vendor-io-default-terms";

const vendorTerms = [{ title: "Vendor Term.", body: "Vendor-specific body." }];
const ioTerms = [{ title: "IO Term.", body: "Deal override body." }];

assert.deepEqual(
  resolveEffectiveVendorIoTerms(serializeTermsText(vendorTerms), serializeTermsText(ioTerms)),
  ioTerms
);
assert.deepEqual(
  resolveEffectiveVendorIoTerms(serializeTermsText(vendorTerms), null),
  vendorTerms
);
assert.deepEqual(resolveEffectiveVendorIoTerms(null, null), VENDOR_IO_DEFAULT_TERMS);
assert.deepEqual(
  resolveDefaultTermsForVendor(serializeTermsText(vendorTerms)),
  vendorTerms
);
assert.deepEqual(resolveDefaultTermsForVendor(null), VENDOR_IO_DEFAULT_TERMS);

// Legacy freeform prose on vendor_ios.terms_text must not parse → fall through.
assert.equal(
  parseTermsText("Vendor IO for Creator — 2 assignment line(s)."),
  null
);
assert.deepEqual(
  resolveEffectiveVendorIoTerms(null, "Operational vendor IO generated from assignment terms."),
  VENDOR_IO_DEFAULT_TERMS
);

assert.equal(resolveIoTermsSource(null, null), "platform");
assert.equal(resolveIoTermsSource(vendorTerms, null), "entity");
assert.equal(resolveIoTermsSource(vendorTerms, ioTerms), "io");

assert.equal(normalizeIoTermsText(""), null);
assert.equal(normalizeIoTermsText("not json"), null);
assert.equal(
  normalizeIoTermsText(serializeTermsText(vendorTerms)),
  serializeTermsText(vendorTerms)
);

assert.ok(VENDOR_IO_DEFAULT_TERMS.length >= 9);
assert.ok(
  VENDOR_IO_DEFAULT_TERMS.some((t) => t.title.startsWith("Scope of Work"))
);

console.log("vendor-io-terms.test.ts: ok");
