import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildShortlistDocument } from "@/features/discovery/shortlists/export/shortlist-document";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import { selectShowcasePublicationShots } from "@/features/discovery/shortlists/export/shortlist-export-publications";
import type { ShortlistDetail } from "@/features/discovery/shortlists/types";
import type { CreatorRecentPublication } from "@/lib/creators/types";

function mockDetail(overrides: Partial<ShortlistDetail> = {}): ShortlistDetail {
  return {
    id: "sl-1",
    serial_number: "SL-2026-0001",
    slug: null,
    name: "Summer Creators",
    description: "Top picks for Q3",
    status: "approved",
    visibility: "team",
    currency: "EGP",
    owner_id: "user-1",
    owner_name: "Alex Manager",
    created_by: "user-1",
    client_id: "client-1",
    client_name: "Acme Corp",
    brand_id: "brand-1",
    brand_name: "Acme Brand",
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    submitted_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    is_archived: false,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-13T08:00:00.000Z",
    creators: [],
    movements: [],
    movedAssignments: [],
    linkedQuotations: [],
    canManage: true,
    canApprove: true,
    ...overrides,
  };
}

{
  const publications: CreatorRecentPublication[] = [
    {
      url: "https://instagram.com/p/abc",
      thumbnail: "https://cdn.example.com/thumb.jpg",
      caption: "Hello",
      likes: 10,
      comments: 2,
      views: null,
      posted_at: null,
    },
  ];
  const shots = selectShowcasePublicationShots(publications, 3);
  assert.equal(shots.length, 1);
  assert.equal(shots[0]?.imageUrl, "https://cdn.example.com/thumb.jpg");
}

{
  const doc = buildShortlistDocument(mockDetail(), { template: "showcase" });
  const html = buildShortlistHtml(doc);
  assert.ok(html.includes("quotation-showcase"));
  assert.ok(html.includes("shortlist-report"));
  assert.ok(html.includes("Discovery Shortlist · Showcase"));
  assert.ok(!html.includes("Proposed deliverable"), "shortlist showcase has no quotation deliverables");
}

{
  const doc = buildShortlistDocument(mockDetail(), { template: "lump-sum" });
  const html = buildShortlistHtml(doc);
  assert.ok(html.includes("Creator mix"));
  assert.ok(html.includes("At a glance"));
  assert.ok(!/body class="[^"]*\bquotation-showcase\b/.test(html));
}

{
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "shortlist-export-publications.ts"),
    "utf8"
  );
  assert.match(
    source,
    /toUnprocessedImageDataUri/,
    "Discovery Showcase publications must embed original bytes"
  );
  assert.doesNotMatch(
    source,
    /toCompressedExportDataUri|compressExportDataUri|SHOWCASE_PUBLICATION_COMPRESS/,
    "Discovery Showcase publication embed must not resize or recompress"
  );
  assert.match(
    source,
    /embedShortlistDocumentPublicationShots/,
    "preview and export share the same publication embed function"
  );

  const previewSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "render-shortlist-preview-html.ts"),
    "utf8"
  );
  assert.match(
    previewSource,
    /embedShortlistDocumentPublicationShots/,
    "Discovery Showcase preview embeds original publication bytes through the same function"
  );
}

{
  const avatarSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "shortlist-export-avatars.ts"),
    "utf8"
  );
  assert.match(
    avatarSource,
    /toUnprocessedImageDataUri/,
    "Discovery Showcase avatars must embed original bytes"
  );
  assert.doesNotMatch(
    avatarSource,
    /toCompressedExportDataUri|compressExportDataUri|SHOWCASE_AVATAR_COMPRESS|PITCH_AVATAR_COMPRESS/,
    "Discovery Showcase avatar embed must not resize or recompress"
  );
}

console.log("shortlist-document.test.ts: ok");
