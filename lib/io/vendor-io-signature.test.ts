import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { signatureSchema, signingInputSchema, signatureSvg, signedVendorIoHtml } from "./vendor-io-signature";
import { renderLiveVendorIoHtml } from "./render-live-vendor-io-html";
import type { SupabaseClient } from "@supabase/supabase-js";

const strokes: [number,number][][] = [[[.1,.2],[.4,.6],[.7,.2]]];
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
