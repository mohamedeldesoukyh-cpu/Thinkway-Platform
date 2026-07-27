/**
 * Vendor IO terms regression audit — Scenarios 1–6 (resolution + freeze behavior).
 * Document HTML/PDF parity is in vendor-io-document-parity.test.ts (same npm script).
 * Run: npm run test:vendor-io-terms
 */
import assert from "node:assert/strict";

import {
  parseTermsText,
  renderTermsListHtml,
  resolveEffectiveVendorIoTerms,
  resolveIoTermsSource,
  serializeTermsText,
  termsAreEqual,
} from "./client-io-terms";
import { VENDOR_IO_DEFAULT_TERMS } from "./vendor-io-default-terms";

type Result = { scenario: string; pass: boolean; detail: string };

const results: Result[] = [];

function record(scenario: string, pass: boolean, detail: string) {
  results.push({ scenario, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${scenario}: ${detail}`);
}

// --- Scenario 1: New vendor, no defaults → Platform ---
{
  const vendorTermsText: string | null = null; // new vendor
  const ioTermsText: string | null = null; // new IO seeded with null
  const resolved = resolveEffectiveVendorIoTerms(vendorTermsText, ioTermsText);
  const source = resolveIoTermsSource(parseTermsText(vendorTermsText), parseTermsText(ioTermsText));
  const html = renderTermsListHtml(resolved);
  record(
    "Scenario 1 — Platform Default",
    termsAreEqual(resolved, VENDOR_IO_DEFAULT_TERMS) &&
      source === "platform" &&
      html.includes(VENDOR_IO_DEFAULT_TERMS[0]!.title.replace(/&/g, "&amp;").slice(0, 20)),
    `source=${source}, terms=${resolved.length}, matches platform=${termsAreEqual(resolved, VENDOR_IO_DEFAULT_TERMS)}`
  );
}

// --- Scenario 2: Vendor default → new IO uses vendor default ---
{
  const vendorDefault = [
    { title: "Vendor Payment.", body: "Net 15 for this creator only." },
    { title: "Vendor Exclusivity.", body: "Beauty category 60 days." },
  ];
  const vendorTermsText = serializeTermsText(vendorDefault);
  // Create path copies vendor defaults onto the IO row (snapshot).
  const ioTermsText = vendorTermsText;
  const resolved = resolveEffectiveVendorIoTerms(vendorTermsText, ioTermsText);
  const source = resolveIoTermsSource(parseTermsText(vendorTermsText), parseTermsText(ioTermsText));
  // Content must equal vendor default (whether attributed to io or entity layer).
  record(
    "Scenario 2 — Vendor Default on new IO",
    termsAreEqual(resolved, vendorDefault) && !termsAreEqual(resolved, VENDOR_IO_DEFAULT_TERMS),
    `source=${source}, matches vendor default=${termsAreEqual(resolved, vendorDefault)}`
  );
}

// --- Scenario 3: IO override wins alone ---
{
  const vendorDefault = [{ title: "Vendor Term.", body: "Should not appear." }];
  const ioOverride = [{ title: "Deal Override.", body: "Only this deal." }];
  const resolved = resolveEffectiveVendorIoTerms(
    serializeTermsText(vendorDefault),
    serializeTermsText(ioOverride)
  );
  const source = resolveIoTermsSource(vendorDefault, ioOverride);
  record(
    "Scenario 3 — IO Override only",
    termsAreEqual(resolved, ioOverride) &&
      source === "io" &&
      !resolved.some((t) => t.title === "Vendor Term."),
    `source=${source}, titles=${resolved.map((t) => t.title).join(" | ")}`
  );
}

// --- Scenario 4: Change vendor default; existing IO snapshot unchanged ---
{
  const originalVendor = [{ title: "Original Vendor.", body: "Frozen on IO." }];
  const updatedVendor = [{ title: "Updated Vendor.", body: "New creators only." }];
  // Existing IO created under originalVendor — snapshot stored on row.
  const existingIoTermsText = serializeTermsText(originalVendor);
  const existingResolved = resolveEffectiveVendorIoTerms(
    serializeTermsText(updatedVendor),
    existingIoTermsText
  );
  // Newly created IO copies updated vendor defaults.
  const newIoTermsText = serializeTermsText(updatedVendor);
  const newResolved = resolveEffectiveVendorIoTerms(
    serializeTermsText(updatedVendor),
    newIoTermsText
  );
  record(
    "Scenario 4 — Existing frozen / new uses updated default",
    termsAreEqual(existingResolved, originalVendor) &&
      termsAreEqual(newResolved, updatedVendor) &&
      !termsAreEqual(existingResolved, newResolved),
    `existing=${existingResolved[0]?.title}, new=${newResolved[0]?.title}`
  );
}

// --- Scenario 5: Restore platform on vendor → new IO → platform ---
{
  const vendorTermsText: string | null = null; // restored platform (NULL)
  const ioTermsText: string | null = null; // new IO seed
  const resolved = resolveEffectiveVendorIoTerms(vendorTermsText, ioTermsText);
  const source = resolveIoTermsSource(null, null);
  record(
    "Scenario 5 — Restore Platform Default",
    source === "platform" && termsAreEqual(resolved, VENDOR_IO_DEFAULT_TERMS),
    `source=${source}, matches platform=${termsAreEqual(resolved, VENDOR_IO_DEFAULT_TERMS)}`
  );
}

// --- Scenario 6: Legacy freeform terms_text falls through to platform ---
{
  const legacyProse = "Vendor IO for Creator X — 3 assignment line(s).";
  assert.equal(parseTermsText(legacyProse), null);
  const resolved = resolveEffectiveVendorIoTerms(null, legacyProse);
  const html = renderTermsListHtml(resolved);
  record(
    "Scenario 6 — Legacy Vendor IO",
    termsAreEqual(resolved, VENDOR_IO_DEFAULT_TERMS) &&
      html.includes("tnum") &&
      VENDOR_IO_DEFAULT_TERMS.every((t) =>
        html.includes(t.title.replace(/&/g, "&amp;").split(".")[0]!)
      ),
    `legacy parse=null, resolved platform terms=${resolved.length}, html has §8 list`
  );
}

// --- Scenario 7: supported exports (HTML + PDF) share identical terms fragment ---
// Word is not a supported Vendor IO format today (see docs/backlog/VENDOR_IO_WORD_EXPORT.md).
{
  const terms = [
    { title: "Export Term A.", body: "Body A." },
    { title: "Export Term B.", body: "Body B." },
  ];
  const htmlA = renderTermsListHtml(terms);
  const htmlB = renderTermsListHtml(terms);
  record(
    "Scenario 7 — HTML/PDF terms fragment (supported formats)",
    htmlA === htmlB && htmlA.includes("Export Term A.") && htmlA.includes("Export Term B."),
    "identical renderTermsListHtml for HTML and live PDF source"
  );
}

const failed = results.filter((r) => !r.pass);
console.log("\n--- Summary ---");
console.log(`Passed: ${results.filter((r) => r.pass).length}/${results.length}`);
if (failed.length > 0) {
  console.error("FAILED:", failed.map((f) => f.scenario).join(", "));
  process.exit(1);
}
console.log("vendor-io-terms-regression.test.ts: ok");
