import assert from "node:assert/strict";
import test from "node:test";
import { authorizeWorkspacePath } from "@/lib/security/workspace-auth";
import { classifyApiPath } from "@/lib/security/workspace-classify";

test("Amgad is internal-only at both page and API boundaries", () => {
  assert.equal(classifyApiPath("/api/accounting/assistant"), "internal_workspace");
  for (const path of ["/accounting", "/api/accounting/assistant"]) {
    for (const actor of ["anonymous", "client_portal", "creator_portal"] as const) {
      assert.equal(authorizeWorkspacePath(path, actor).allowed, false);
    }
    assert.equal(authorizeWorkspacePath(path, "internal").allowed, true);
  }
});
