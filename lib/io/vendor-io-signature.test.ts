import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { signatureSchema, signingInputSchema, signatureSvg, typedSignatureSvg, signedVendorIoHtml } from "./vendor-io-signature";
import { renderLiveVendorIoHtml } from "./render-live-vendor-io-html";
import type { SupabaseClient } from "@supabase/supabase-js";
import { vendorIoSigningPreview } from "./vendor-io-signing-preview";

const strokes: [number,number][][] = [[[.1,.2],[.4,.6],[.7,.2]]];
test("terms disclosure preserves all terms behind a clearly labelled expandable heading", () => {
  const html = '<section class="qsec section terms-section"><div class="qh"><h3>Terms</h3></div><ul><li>Original payment obligation</li></ul></section><p>After terms</p>';
  const preview = vendorIoSigningPreview(html);
  assert.match(preview, /<details class=/);
  assert.doesNotMatch(preview, /<details open/);
  assert.match(preview, /Terms and conditions — tap to review/);
  assert.match(preview, /<ul><li>Original payment obligation<\/li><\/ul>/);
  assert.match(preview, /<p>After terms<\/p>/);
  assert.equal(vendorIoSigningPreview('<p>Legacy document</p>'), '<p>Legacy document</p>');
});
test("typed signatures require an explicit method and valid name; drawn signatures still require strokes", () => {
  const base = { name: "Test Signer", documentHash: "a".repeat(64), token: "test", consent: true };
  assert.equal(signingInputSchema.safeParse({ ...base, method: "type", consent: false }).success, false);
  assert.equal(signingInputSchema.safeParse(base).success, false);
  assert.equal(signingInputSchema.safeParse({ ...base, method: "type" }).success, true);
  assert.equal(signingInputSchema.safeParse({ ...base, method: "type", name: " " }).success, false);
  assert.equal(signingInputSchema.safeParse({ ...base, method: "unknown" }).success, false);
  assert.equal(signingInputSchema.parse({ ...base, strokes }).method, "draw");
  const svg = typedSignatureSvg('<script> & "Name"');
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt; &amp;/);
  assert.match(typedSignatureSvg("محمد مصطفى"), /محمد مصطفى/);
  assert.match(typedSignatureSvg("Test Signer"), /font-family="ThinkwaySignature, cursive"/);
});
test("blank, stationary, oversized and injected signatures are rejected", () => {
  for(const invalid of [[],[[[.2,.2]]],[[[.2,.2],[.2,.2]]],[[[-1,.2],[1,.2]]],[[["<svg>",0],[1,1]]],Array.from({length:31},()=>strokes[0])]) {
    assert.equal(signatureSchema.safeParse(invalid).success,false);
  }
  assert.ok(signatureSchema.safeParse(strokes).success);
  assert.equal(signingInputSchema.safeParse({ name:" ",strokes,documentHash:"a".repeat(64),token:"test" }).success,false);
});
test("signed snapshot contains signature, escaped name, consent and exact document digest", () => {
  const svg=signatureSvg(strokes);
  assert.match(svg,/<polyline/);
  const html=signedVendorIoHtml({ html:"<html><body><p>3 UGC / AED 2250</p></body></html>",name:'<script>alert(1)</script>',signedAt:"2026-11-11T02:00:00Z",documentHash:"a".repeat(64),signatureDataUrl:`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` });
  assert.match(html,/3 UGC \/ AED 2250/);
  assert.match(html,/Signed &amp; Approved/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/By signing, I agree/);
  assert.match(html,new RegExp("a".repeat(64)));
});
test("approved document rendering returns immutable signed snapshot without rebuilding current assignments", async () => {
  const db={from(table:string){assert.equal(table,"vendor_io_signatures");return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{signed_html:"<p>Exact signed document</p>"},error:null};}};}} as unknown as SupabaseClient;
  assert.equal(await renderLiveVendorIoHtml(db,"io"),"<p>Exact signed document</p>");
});
test("email GET and creator portal cannot perform an unsigned approval", () => {
  const page=readFileSync("app/io-approval/vendor/page.tsx","utf8");
  assert.doesNotMatch(page,/completeVendorIoApprovalByToken|approve_vendor_io_by_token/);
  assert.match(page,/loadVendorSigningSession/);
  const portal=readFileSync("features/portals/components/creator-approve-vendor-io-form.tsx","utf8");
  assert.match(portal,/Review &amp; Sign/);
  assert.doesNotMatch(portal,/creatorApproveVendorIoAction/);
});
