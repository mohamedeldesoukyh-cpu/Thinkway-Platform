import assert from "node:assert/strict";

import {
  STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS,
  isStuckQueuedEnrichmentRow,
  isStuckRunningEnrichmentRow,
  resolveStuckQueuedEnrichmentStatus,
} from "@/lib/creator-enrichment/recover-stuck-enrichments";

const NOW = Date.parse("2026-06-28T12:00:00.000Z");

function row(
  overrides: Partial<{
    id: string;
    enrichment_status: string;
    last_enriched_at: string | null;
    updated_at: string | null;
  }> = {}
) {
  return {
    id: "inf-1",
    enrichment_status: "queued",
    last_enriched_at: null,
    updated_at: "2026-06-28T11:40:00.000Z",
    ...overrides,
  };
}

{
  const staleQueued = row();
  assert.equal(isStuckQueuedEnrichmentRow(staleQueued, NOW), true);
}

{
  const recentQueued = row({ updated_at: "2026-06-28T11:55:00.000Z" });
  assert.equal(isStuckQueuedEnrichmentRow(recentQueued, NOW), false);
}

{
  const staleRunning = row({
    enrichment_status: "running",
    updated_at: "2026-06-28T11:40:00.000Z",
  });
  assert.equal(isStuckRunningEnrichmentRow(staleRunning, NOW), true);
}

{
  assert.equal(
    resolveStuckQueuedEnrichmentStatus(row({ last_enriched_at: null })),
    "never"
  );
  assert.equal(
    resolveStuckQueuedEnrichmentStatus(
      row({ last_enriched_at: "2026-05-01T00:00:00.000Z" })
    ),
    "failed"
  );
}

assert.equal(STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS, 10 * 60 * 1000);

console.log("creator-enrichment recover-stuck tests passed");
