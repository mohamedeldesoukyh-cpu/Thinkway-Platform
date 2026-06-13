import assert from "node:assert/strict";

import { CLIENT_IO_DEFAULT_TERMS } from "./client-io-default-terms";
import {
  parseTermsText,
  renderTermsListHtml,
  resolveEffectiveTerms,
  resolveDefaultTermsForClient,
  serializeTermsText,
  termsAreEqual,
} from "./client-io-terms";

const clientTerms = [{ title: "Client Term.", body: "Client-specific body." }];
const cioTerms = [{ title: "CIO Term.", body: "CIO override body." }];

assert.deepEqual(resolveEffectiveTerms(CLIENT_IO_DEFAULT_TERMS, clientTerms, cioTerms), cioTerms);
assert.deepEqual(resolveEffectiveTerms(CLIENT_IO_DEFAULT_TERMS, clientTerms, null), clientTerms);
assert.deepEqual(resolveEffectiveTerms(CLIENT_IO_DEFAULT_TERMS, null, null), CLIENT_IO_DEFAULT_TERMS);

const clientJson = serializeTermsText(clientTerms);
assert.deepEqual(resolveDefaultTermsForClient(clientJson), clientTerms);
assert.deepEqual(resolveDefaultTermsForClient(null), CLIENT_IO_DEFAULT_TERMS);

const roundTrip = serializeTermsText(CLIENT_IO_DEFAULT_TERMS.slice(0, 2));
assert.deepEqual(parseTermsText(roundTrip), CLIENT_IO_DEFAULT_TERMS.slice(0, 2));
assert.equal(parseTermsText(""), null);
assert.equal(parseTermsText("not json"), null);

const html = renderTermsListHtml([{ title: "Test.", body: "Body text." }]);
assert.match(html, /class="tnum">1<\/span>/);
assert.match(html, /<strong>Test\.<\/strong> Body text\./);

assert.equal(termsAreEqual(clientTerms, [...clientTerms]), true);
assert.equal(termsAreEqual(clientTerms, cioTerms), false);

console.log("client-io-terms.test.ts: ok");
