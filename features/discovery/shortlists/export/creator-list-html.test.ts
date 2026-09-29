import assert from "node:assert/strict";
import test from "node:test";
import { buildCreatorListHtml } from "./creator-list-html";
import { resolveShortlistTemplate, appendShortlistTemplateParam } from "./shortlist-template";
import type { ShortlistDocument, ShortlistDocCreatorGroup } from "./shortlist-document";

function document(count: number): ShortlistDocument {
  return { name: "Campaign <one>", serial: "SL-1", description: "Concept & campaign", brandName: "Brand", creatorGroups: Array.from({ length: count }, (_, i) => ({ creator: `Creator ${i}`, handle: "@creator", country: "Egypt", avatarUrl: null, profileUrl: "javascript:alert(1)", publicationShots: [], notes: "PRIVATE NOTE" } as unknown as ShortlistDocCreatorGroup)) } as ShortlistDocument;
}
test("creator list is a distinct shortlist option and retains its URL parameter", () => {
  assert.equal(resolveShortlistTemplate("creator-list"), "creator-list");
  const params = new URLSearchParams();
  appendShortlistTemplateParam(params, "creator-list");
  assert.equal(params.get("template"), "creator-list");
});
test("seven creators produce six aligned cards then one on the next page", () => {
  const html = buildCreatorListHtml(document(7));
  assert.equal((html.match(/class="page"/g) ?? []).length, 2);
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
  assert.ok(html.includes("&lt;caption&gt;"));
  assert.ok(!html.includes("avatar.png"));
  assert.ok(buildCreatorListHtml(document(0)).includes("No creators selected"));
});
