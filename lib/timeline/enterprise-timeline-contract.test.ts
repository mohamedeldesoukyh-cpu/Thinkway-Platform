import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildEnterpriseTimelineMetadata,
  ENTERPRISE_TIMELINE_SOURCE,
  mapMediaPlanEngineEventToEnterprise,
} from "./enterprise-timeline-contract";

test("maps Media Plan engine events to enterprise contract names", () => {
  assert.equal(mapMediaPlanEngineEventToEnterprise("client_approved"), "media_plan.client_approved");
  assert.equal(mapMediaPlanEngineEventToEnterprise("baseline_published"), "media_plan.baseline_published");
  assert.equal(mapMediaPlanEngineEventToEnterprise("schedule_edited"), null);
});

test("buildEnterpriseTimelineMetadata normalizes Assignment-aware payload", () => {
  const meta = buildEnterpriseTimelineMetadata({
    event: "assignment.created",
    summary: "Assignment line-1 created",
    campaign_id: "camp-1",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-1",
    module: "assignments",
  });
  assert.equal(meta.source, ENTERPRISE_TIMELINE_SOURCE);
  assert.equal(meta.event, "assignment.created");
  assert.equal(meta.label, "Assignment created");
  assert.equal(meta.campaign_line_id, "line-1");
});

test("buildEnterpriseTimelineMetadata labels Client IO generated events", () => {
  const meta = buildEnterpriseTimelineMetadata({
    event: "client_io.generated",
    summary: "Client IO CIO-2026-0001 generated (2 Assignments)",
    campaign_id: "camp-1",
    campaign_header_id: "camp-1",
    client_io_id: "cio-1",
    selected_assignment_ids: ["line-1", "line-2"],
    module: "client_io",
  });
  assert.equal(meta.label, "Client IO generated");
  assert.equal(meta.client_io_id, "cio-1");
  assert.deepEqual(meta.selected_assignment_ids, ["line-1", "line-2"]);
});
