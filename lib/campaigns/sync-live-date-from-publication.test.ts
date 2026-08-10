import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeLiveDateMetadata,
  readLiveDateMetadata,
  withManualLiveDateSource,
} from "@/lib/campaigns/sync-live-date-from-publication";

describe("sync-live-date-from-publication metadata", () => {
  it("reads publication and manual live date source", () => {
    assert.deepEqual(
      readLiveDateMetadata({
        live_date_source: "publication",
        publication_live_date: "2026-08-01",
        publication_id: "pub-1",
        platform: "instagram",
      }),
      {
        live_date_source: "publication",
        publication_live_date: "2026-08-01",
        publication_id: "pub-1",
      }
    );

    assert.equal(
      readLiveDateMetadata({ live_date_source: "manual" }).live_date_source,
      "manual"
    );
    assert.equal(readLiveDateMetadata({ live_date_source: "other" }).live_date_source, undefined);
  });

  it("merges without dropping unrelated metadata", () => {
    const merged = mergeLiveDateMetadata(
      { platform: "tiktok", deliverable_type: "tiktok_video" },
      {
        live_date_source: "publication",
        publication_live_date: "2026-07-15",
        publication_id: "pub-2",
      }
    );
    assert.equal(merged.platform, "tiktok");
    assert.equal(merged.deliverable_type, "tiktok_video");
    assert.equal(merged.live_date_source, "publication");
    assert.equal(merged.publication_live_date, "2026-07-15");
  });

  it("marks manual overwrite while keeping publication default", () => {
    const next = withManualLiveDateSource({
      publication_live_date: "2026-07-15",
      live_date_source: "publication",
      platform: "instagram",
    });
    assert.equal(next.live_date_source, "manual");
    assert.equal(next.publication_live_date, "2026-07-15");
    assert.equal(next.platform, "instagram");
  });
});
