#!/usr/bin/env npx tsx
/**
 * Phase 0.3 — Campaign Object Persistence validation
 * Run: npm run validate:campaign-persistence
 */
import fs from "node:fs";
import path from "node:path";

import {
  CAMPAIGN_LIFECYCLE_STATUSES,
  type CampaignObjectLifecycleStatus,
} from "./types/campaign-lifecycle";
import {
  canTransitionLifecycle,
  isValidLifecycleTransition,
} from "./services/campaign-lifecycle";
import {
  deserializeCampaignObject,
  serializeCampaignObject,
} from "./services/campaign-object-store";
import { createEmptyCampaignObject } from "./services/section-updaters";

const ROOT = path.resolve(import.meta.dirname, "../..");

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

console.log("\n=== Phase 0.3 Campaign Persistence Validation ===\n");

console.log("1. Schema & service artifacts");
assert(
  "migration exists",
  fileExists("supabase/migrations/20260712010000_campaign_object_persistence.sql")
);
assert(
  "persistence service exists",
  fileExists("features/campaign-intelligence/services/campaign-object-persistence.ts")
);
assert(
  "lifecycle helpers exist",
  fileExists("features/campaign-intelligence/services/campaign-lifecycle.ts")
);
assert(
  "export helper exists",
  fileExists("features/campaign-intelligence/services/campaign-export.ts")
);
assert(
  "persistence report exists",
  fileExists("docs/infrastructure/CAMPAIGN_PERSISTENCE_REPORT.md")
);

console.log("\n2. Serialization round-trip");
const sample = createEmptyCampaignObject({
  id: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  workflowId: "create-campaign",
});
const serialized = serializeCampaignObject(sample);
const restored = deserializeCampaignObject(serialized);
assert("serialize preserves id", restored.id === sample.id);
assert("serialize preserves workflowId", restored.workflowId === sample.workflowId);
assert("serialize preserves section keys", Object.keys(restored.sections).length === 9);

console.log("\n3. Lifecycle transitions");
const validPairs: Array<[CampaignObjectLifecycleStatus, CampaignObjectLifecycleStatus]> = [
  ["draft", "in_review"],
  ["in_review", "approved"],
  ["approved", "published"],
  ["published", "archived"],
  ["archived", "draft"],
];
for (const [from, to] of validPairs) {
  assert(`allows ${from} → ${to}`, isValidLifecycleTransition(from, to));
}
assert("blocks draft → published", !isValidLifecycleTransition("draft", "published"));
assert(
  "lifecycle enum count",
  CAMPAIGN_LIFECYCLE_STATUSES.length === 5
);

console.log("\n4. Permission helpers (offline stubs)");
void canTransitionLifecycle;

console.log("\n5. Store autosave hook");
const storeSource = fs.readFileSync(
  path.join(ROOT, "features/campaign-intelligence/services/campaign-object-store.ts"),
  "utf8"
);
assert("store calls persistence service", storeSource.includes("CampaignObjectPersistenceService.saveVersion"));
assert("store exposes loadCampaignObjectForConversation", storeSource.includes("loadCampaignObjectForConversation"));
assert("store exposes isAutosaveTaskStatus", storeSource.includes("isAutosaveTaskStatus"));

console.log("\n6. Workflow adapter hook");
const adapterSource = fs.readFileSync(
  path.join(ROOT, "features/ai-workspace/services/workflow-adapter.ts"),
  "utf8"
);
assert("adapter restores from DB", adapterSource.includes("loadCampaignObjectForConversation"));
assert("adapter passes userId", adapterSource.includes("userId: options.userId"));

console.log("\n7. API routes");
for (const route of [
  "app/api/ai/campaign-objects/[id]/versions/route.ts",
  "app/api/ai/campaign-objects/[id]/versions/[version]/route.ts",
  "app/api/ai/campaign-objects/[id]/export/route.ts",
  "app/api/ai/campaign-objects/[id]/lifecycle/route.ts",
]) {
  assert(`${path.basename(path.dirname(route))} route`, fileExists(route));
}

console.log("\n--- Summary ---");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log("\nPhase 0.3 campaign persistence validation passed.\n");
