import assert from "node:assert/strict";
import test from "node:test";
import { buildCreatorListHtml, renderCreatorListReport, creatorListPlatform } from "./creator-list-html";
import { resolveShortlistTemplate, appendShortlistTemplateParam } from "./shortlist-template";
import type { ShortlistDocument, ShortlistDocCreatorGroup } from "./shortlist-document";

function document(count: number): ShortlistDocument {
  return { name: "Campaign <one>", serial: "SL-1", generatedDateLabel: "29 Sep 2026", description: "Concept & campaign", brandName: "Brand", creatorGroups: Array.from({ length: count }, (_, i) => ({ creator: `Creator ${i}`, handle: "@creator", country: "Egypt", avatarUrl: null, profileUrl: "javascript:alert(1)", publicationShots: [], notes: "PRIVATE NOTE" } as unknown as ShortlistDocCreatorGroup)) } as ShortlistDocument;
}
test("creator list is a distinct shortlist option and retains its URL parameter", () => {
  assert.equal(resolveShortlistTemplate("creator-list"), "creator-list");
  const params = new URLSearchParams();
  appendShortlistTemplateParam(params, "creator-list");
  assert.equal(params.get("template"), "creator-list");
});
test("seven creators produce six aligned cards then one on the next page", () => {
  const html = buildCreatorListHtml(document(7));
  assert.equal((html.match(/<section class="page/g) ?? []).length, 4);
  assert.equal((html.match(/class="creator-card"/g) ?? []).length, 7);
  assert.ok(html.includes("Campaign &lt;one&gt;"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("PRIVATE NOTE"));
});
test("embedded publication takes precedence over avatar; empty list remains valid", () => {
  const doc = document(1);
  doc.creatorGroups[0].avatarUrl = "https://example.com/avatar.png";
  doc.creatorGroups[0].publicationShots = [{ imageUrl: "data:image/png;base64,AAAA", postUrl: "https://example.com/post", caption: "<caption>", isVideo: true }];
  const html = buildCreatorListHtml(doc);
  assert.ok(html.includes('src="data:image/png;base64,AAAA"'));
  assert.ok(html.includes('href="https://example.com/post"'));
  assert.ok(!html.includes("avatar.png"));
  assert.ok(buildCreatorListHtml(document(0)).includes("0 creators"));
});

test("platform comes only from the destination host", () => {
  assert.equal(creatorListPlatform("https://www.instagram.com/p/test/"), "Instagram");
  assert.equal(creatorListPlatform("https://www.tiktok.com/@test/video/1"), "TikTok");
  assert.equal(creatorListPlatform("https://example.com/instagram.com"), null);
  assert.equal(creatorListPlatform(null), null);
});

test("109-row shape preserves completeness, links, indexes and offline branding", () => {
  const creators = Array.from({length:109}, (_,i) => ({name:`Creator ${i}`,handle:`@creator${i}`,profileUrl:`https://${i < 100 ? "instagram" : "tiktok"}.com/creator${i}`,portrait:i<102 ? "data:image/png;base64,AAAA" : null,markets:i<48 ? ["Egypt","TR","CN"] : []}));
  const report = {name:"Baby Joy",reference:"SL-2026-0031",issuedDate:"29 Sep 2026",creators};
  const html = renderCreatorListReport(report);
  assert.equal((html.match(/<section class="page/g) ?? []).length,21);
  assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length,109);
  assert.equal((html.match(/class="brand-lockup"/g) ?? []).length,21);
  assert.ok(!html.includes('class="loc'));
  assert.ok(!html.includes('class="shade"'));
  assert.ok(!html.includes('Egypt'));
  assert.equal((html.match(/class="placeholder"/g) ?? []).length,7);
  assert.equal((html.match(/class="pb pb--ig"/g) ?? []).length,100);
  assert.equal((html.match(/class="pb pb--tt"/g) ?? []).length,9);
  assert.match(html, /<b>0<\/b> of 109 creators have categories recorded/);
  assert.match(html, /<b>7<\/b> profiles have no portrait/);
  assert.deepEqual([...html.matchAll(/class="idx" aria-hidden="true">(\d+)/g)].map(m=>m[1]),Array.from({length:109},(_,i)=>String(i+1).padStart(3,"0")));
  assert.ok(!html.includes('class="mk"'));
  assert.ok(!html.includes('class="wm"'));
  assert.ok(!/Math\.random\s*\(/.test(html));
  assert.equal(html,renderCreatorListReport(report));
});

test("empty and complete reports state their gaps and client logo remains optional", () => {
  const report = {name:"Client",reference:"SL-1",issuedDate:"Today",creators:[]};
  assert.match(renderCreatorListReport(report), /No category gaps/);
  assert.match(renderCreatorListReport(report), /All portraits are supplied/);
  assert.match(renderCreatorListReport({...report,clientLogo:"data:image/png;base64,AAAA"}), /data-logo-slot><img src="data:image\/png;base64,AAAA"/);
  assert.match(renderCreatorListReport(report), /data-logo-slot><h1/);
});

test("cards show the recorded avatar and categories without countries or tint", () => {
  const doc = document(1);
  doc.creatorGroups[0].avatarUrl = 'data:image/png;base64,AAAA';
  doc.creatorGroups[0].categories = ['Parenting', 'Beauty & care'];
  const html = buildCreatorListHtml(doc);
  assert.match(html, /class="creator-avatar" src="data:image\/png;base64,AAAA"/);
  assert.match(html, /class="creator-category">Parenting/);
  assert.match(html, /Beauty &amp; care/);
  assert.ok(!html.includes('Egypt'));
  assert.ok(!html.includes('class="shade"'));
});
