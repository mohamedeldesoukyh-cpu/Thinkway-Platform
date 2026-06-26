import assert from "node:assert/strict";

import {
  schedulePublicationWorkspaceOpen,
  shouldPreventSheetOutsideDismiss,
} from "@/features/campaigns/components/performance/publication-workspace/publication-workspace-open-policy";

assert.equal(shouldPreventSheetOutsideDismiss(null), false);

let openedId: string | null = null;
schedulePublicationWorkspaceOpen("pub-123", (id) => {
  openedId = id;
});

if (typeof window === "undefined") {
  assert.equal(openedId, "pub-123", "Node should open synchronously");
}

console.log("publication-workspace-open-policy tests passed");
