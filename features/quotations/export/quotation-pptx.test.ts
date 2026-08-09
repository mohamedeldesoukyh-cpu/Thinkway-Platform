import assert from "node:assert/strict";

import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationPptxBuffer } from "@/features/quotations/export/quotation-pptx";
import { buildQuotationTemplatePayload } from "@/features/quotations/templates/quotation-template-payload";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";

function mockItem(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: "inf-1",
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator A",
    platform: "instagram",
    handle: "@creator",
    followers: 10000,
    engagement_rate: 3,
    country_code: "EG",
    profile_image_url: null,
    profile_url: "https://www.instagram.com/creator/",
    deliverables: [],
    option_number: 1,
    service_description: "1× IG Reel",
    commercial_input_mode: "cost_gp_pct",
    cost: 1000,
    cost_currency: "EGP",
    revenue: 1333.33,
    gp_pct: 25,
    gp_value: 333.33,
    fx_rate_to_egp: 1,
    cost_egp: 1000,
    revenue_egp: 1333.33,
    gp_value_egp: 333.33,
    af_pct: 10,
    af_value: 133.33,
    af_value_egp: 133.33,
    sort_order: 0,
    ...overrides,
  };
}

function mockDetail(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: "q-1",
    serial_number: "QT-2026-0001",
    name: "Quotation — Test Campaign",
    status: "draft",
    shortlist_id: null,
    shortlist_serial: null,
    client_id: "c-1",
    client_name: "Acme Corp",
    group_name: null,
    agency_or_direct: null,
    agency_name: null,
    is_temporary_client: false,
    is_temporary_brand: false,
    temporary_client_name: null,
    temporary_brand_name: null,
    brand_id: "b-1",
    brand_name: "Acme Brand",
    campaign_header_id: null,
    campaign_name: null,
    campaign_document_number: null,
    campaign_object_id: null,
    source_campaign_object_version: null,
    parent_quotation_id: null,
    version_number: 1,
    revision_notes: null,
    sync_enabled: true,
    version_chain: [],
    owner_id: null,
    owner_name: "Alex",
    approved_by: null,
    approved_at: null,
    currency: "EGP",
    total_cost_egp: 1000,
    total_revenue_egp: 1333.33,
    total_gp_value_egp: 333.33,
    total_gp_pct: 25,
    total_af_egp: 133.33,
    total_agency_margin_egp: 466.66,
    gp_target_pct: 25,
    notes: null,
    terms: null,
    prepared_by_name: "Alex",
    reviewed_by_name: null,
    client_signature_name: null,
    client_signed_at: null,
    client_onboarding_status: null,
    issue_date: "2026-06-01",
    validity_date: "2026-06-16",
    version: "v1.0",
    department: "Influencer Marketing",
    change_summary: null,
    shared_with_client: false,
    client_visible: false,
    is_archived: false,
    is_expired: false,
    valid_days_remaining: 10,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    items: [mockItem()],
    revisions: [],
    canManage: true,
    estimated_reach: 10000,
    estimated_engagement_rate: 3,
    ...overrides,
  };
}

async function assertWidescreenLayout(buffer: Buffer): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  assert.ok(presentation, "PPTX should include presentation.xml");
  // Reference deck: 13.333" × 7.5" (EMU cx≈12191695, cy=6858000). pptxgenjs uses 12192000×6858000.
  assert.match(presentation, /sldSz[^>]*cy="6858000"/);
  assert.match(presentation, /sldSz[^>]*cx="1219\d+"/);
}

async function main() {
  {
    const doc = buildQuotationDocument(mockDetail(), { template: "detailed" });
    const buffer = await buildQuotationPptxBuffer(doc);
    assert.ok(buffer.length > 5_000, "Detailed PPTX buffer should be non-trivial");
    assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK", "PPTX should be a ZIP archive");
    await assertWidescreenLayout(buffer);
  }

  {
    const doc = buildQuotationDocument(mockDetail(), { template: "showcase" });
    const buffer = await buildQuotationPptxBuffer(doc);
    assert.ok(buffer.length > 5_000, "Showcase PPTX buffer should be non-trivial");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const joined = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((path) => /ppt\/slides\/slide\d+\.xml/.test(path))
          .map(async (path) => zip.file(path)?.async("string") ?? "")
      )
    ).join("\n");
    assert.match(joined, /ISSUE · VALID/, "Showcase cover uses compact Issue · Valid meta");
    assert.match(joined, /TOTAL INVESTMENT/, "Showcase includes redesign TOTAL INVESTMENT banner");
    assert.doesNotMatch(
      joined,
      /Campaign mix insight/,
      "Showcase PPTX must not use legacy mix-insight slide"
    );
    assert.doesNotMatch(joined, /Mix summary/, "Showcase PPTX must not use legacy Mix summary title");
    assert.doesNotMatch(
      joined,
      /PREPARED BY/,
      "Showcase cover must omit Prepared By (HTML redesign parity)"
    );
  }

  {
    const doc = buildQuotationDocument(mockDetail(), { template: "showcase-lump-sum" });
    const buffer = await buildQuotationPptxBuffer(doc);
    assert.ok(buffer.length > 5_000, "Showcase Lump Sum PPTX buffer should be non-trivial");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const joined = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((path) => /ppt\/slides\/slide\d+\.xml/.test(path))
          .map(async (path) => zip.file(path)?.async("string") ?? "")
      )
    ).join("\n");
    assert.match(joined, /TOTAL INVESTMENT/, "Showcase Lump Sum includes TOTAL INVESTMENT banner");
    assert.doesNotMatch(
      joined,
      /Campaign mix insight/,
      "Showcase Lump Sum must not use legacy mix-insight slide"
    );
  }

  {
    const doc = buildQuotationDocument(
      mockDetail({
        items: [
          mockItem({
            id: "collapse-leader",
            collapse_group_id: "cg-1",
            collapse_label: "Collap",
            creator_name: "Creator A",
            handle: "@creator_a",
            sort_order: 1,
            revenue: 250000,
            revenue_egp: 250000,
            deliverables: [{ platform: "instagram", type: "instagram_reel", quantity: 1 }],
          }),
          mockItem({
            id: "collapse-follower",
            influencer_id: "inf-2",
            collapse_group_id: "cg-1",
            collapse_label: "Collap",
            creator_name: "Creator B",
            handle: "@creator_b",
            sort_order: 2,
            revenue: 0,
            revenue_egp: 0,
            deliverables: [],
          }),
        ],
      }),
      { template: "detailed" }
    );
    assert.ok(doc.collapseContentGroups.length === 1);
    assert.match(doc.collapseContentGroups[0]?.packages[0]?.clientCost ?? "", /250,000 EGP/);
    const payload = buildQuotationTemplatePayload(doc);
    const collapFee = payload.feeLines.find((line) => line.deliverable.includes("Collap package"));
    assert.equal(collapFee?.grossFee, "250,000");
    const buffer = await buildQuotationPptxBuffer(doc);
    assert.ok(buffer.length > 5_000);
    await assertWidescreenLayout(buffer);

    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await Promise.all(
      Object.keys(zip.files)
        .filter((path) => /ppt\/slides\/slide\d+\.xml/.test(path))
        .map(async (path) => zip.file(path)?.async("string") ?? "")
    );
    const joined = slideXml.join("\n");
    assert.match(joined, /SECTION 01 · COLLAB PACKAGES/);
    assert.match(joined, /CLIENT COST/);
    assert.match(joined, /· Packages/);
    assert.match(joined, /Collab ·/);
    assert.match(joined, /worth watching/);
    assert.match(joined, /SECTION 03 · TERMS/);
    const mediaFiles = Object.keys(zip.files).filter((path) =>
      path.startsWith("ppt/media/")
    );
    assert.ok(
      mediaFiles.length >= 3,
      `expected cover/content/closing background images, got ${mediaFiles.length}`
    );
  }

  {
    const doc = buildQuotationDocument(
      mockDetail({
        items: [
          mockItem({
            id: "collapse-leader",
            collapse_group_id: "cg-1",
            collapse_label: "Collap",
            creator_name: "Creator A",
            handle: "@creator_a",
            sort_order: 1,
            revenue: 250000,
            revenue_egp: 250000,
            deliverables: [{ platform: "instagram", type: "instagram_reel", quantity: 1 }],
          }),
          mockItem({
            id: "collapse-follower",
            influencer_id: "inf-2",
            collapse_group_id: "cg-1",
            collapse_label: "Collap",
            creator_name: "Creator B",
            handle: "@creator_b",
            sort_order: 2,
            revenue: 0,
            revenue_egp: 0,
            deliverables: [],
          }),
        ],
      }),
      { template: "showcase" }
    );
    const payload = buildQuotationTemplatePayload(doc);
    const followerGroup = doc.creatorGroups.find((group) => group.creator === "Creator B");
    assert.ok(followerGroup, "follower creator group exists");
    const followerPayload = payload.showcaseCreators.find(
      (creator) => creator.name === "Creator B"
    );
    assert.equal(
      followerPayload?.deliverables.length,
      0,
      "Collapse followers omit empty-priced rows"
    );
    const leaderPayload = payload.showcaseCreators.find((creator) => creator.name === "Creator A");
    assert.match(leaderPayload?.deliverables[0]?.service ?? "", /Collap package/);
    assert.equal(leaderPayload?.deliverables[0]?.grossFee, "250,000");
    const buffer = await buildQuotationPptxBuffer(doc);
    assert.ok(buffer.length > 5_000);
  }

  console.log("quotation-pptx.test.ts passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
