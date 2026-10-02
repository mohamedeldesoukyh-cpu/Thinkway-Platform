import assert from "node:assert/strict";
import { test } from "node:test";
import { loadClientCampaignExecution } from "./load-campaign-execution";
import { loadClientCampaignContent } from "./load-campaign-content";

test("client campaign uses the replacement and excludes the removed creator's schedule and content", async () => {
  const rows: Record<string, Array<Record<string, unknown>>> = {
    campaign_lines: [
      { id: "old", name: "Removed creator", status: "cancelled", metadata: {} },
      { id: "new", name: "Replacement creator", status: "active", metadata: {} },
    ],
    campaign_influencers: [
      { campaign_line_id: "old", influencer_id: "old-person", influencer: { display_name: "Removed creator" } },
      { campaign_line_id: "new", influencer_id: "new-person", influencer: { display_name: "Replacement creator" } },
    ],
    assignment_deliverables: ["old", "new"].map(id => ({ id: `${id}-deliverable`, campaign_line_id: id, platform: "instagram", deliverable_type: "reel", quantity: 1 })),
    deliverable_assets: ["old", "new"].map(id => ({ id: `${id}-asset`, campaign_header_id: "campaign", assignment_deliverable_id: `${id}-deliverable`, asset_type: "draft_video", medium: "external_link", current_version_id: `${id}-version`, archived_at: null })),
    deliverable_asset_versions: ["old", "new"].map(id => ({ id: `${id}-version`, asset_id: `${id}-asset`, version_number: 1, external_url: `https://example.com/${id}.mp4`, uploaded_at: "2026-09-30T12:00:00Z", metadata: { released_to_client_at: "2026-09-30T12:00:00Z" } })),
  };
  const db = { from(table: string) {
    let data = [...(rows[table] ?? [])];
    const query: any = {
      select: () => query, eq: () => query, is: () => query, order: () => query,
      neq: (key: string, value: unknown) => { data = data.filter(row => row[key] !== value); return query; },
      in: (key: string, values: unknown[]) => { data = data.filter(row => values.includes(row[key])); return query; },
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return query;
  } };
  const execution = await loadClientCampaignExecution(db as never, "campaign", true);
  assert.ok(execution.posts.length > 0);
  assert.match(JSON.stringify(execution), /Replacement creator/);
  assert.doesNotMatch(JSON.stringify(execution), /Removed creator|old-deliverable|old-person/);
  const content = await loadClientCampaignContent(db as never, "campaign", true);
  assert.match(JSON.stringify(content), /new-asset/);
  assert.doesNotMatch(JSON.stringify(content), /old-asset|old-version|Removed creator/);
});
