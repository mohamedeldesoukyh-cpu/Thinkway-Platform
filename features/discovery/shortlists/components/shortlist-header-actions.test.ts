import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const workspace = readFileSync(
  resolve("features/discovery/shortlists/components/shortlist-workspace.tsx"),
  "utf8"
);
const header = readFileSync(
  resolve("features/discovery/shortlists/components/shortlist-header-actions.tsx"),
  "utf8"
);
const adapter = readFileSync(
  resolve("features/discovery/shortlists/components/shortlist-document-output-toolbar.tsx"),
  "utf8"
);
const shared = readFileSync(
  resolve("features/discovery/document-output/document-output-toolbar.tsx"),
  "utf8"
);
const bulk = readFileSync(
  resolve("features/discovery/shortlists/components/shortlist-bulk-toolbar.tsx"),
  "utf8"
);

describe("shortlist header button layer", () => {
  it("keeps document actions in the header and Add creators in the table toolbar", () => {
    assert.match(workspace, /ShortlistHeaderActions/);
    assert.match(header, /aria-label="View settings"/);
    assert.doesNotMatch(header, /\+ Add creators/);
    assert.match(workspace, /onAddCreators/);
    assert.match(header, /Complete brief/);
    assert.match(header, /OpenCampaignStudioLauncher/);
    assert.match(header, /GenerateOutputsLauncher/);
    assert.match(header, /tone="toolbar"/);
  });

  it("keeps output formats and creator selection in the centered chooser", () => {
    assert.match(header, /ShortlistDocumentOutputToolbar/);
    assert.match(adapter, /DocumentOutputToolbar/);
    assert.match(adapter, /sl-output-dialog/);
    assert.match(adapter, /DocumentCreatorSelectionDialog/);
    assert.match(adapter, /SHORTLIST_DOCUMENT_OUTPUT_FORMATS/);
    assert.match(adapter, /id: "csv"/);
    assert.match(shared, /formats: DocumentOutputFormatOption/);
    assert.doesNotMatch(shared, /quotation/i);
    assert.doesNotMatch(shared, /shortlist/i);
    assert.match(adapter, /Client link/);
    assert.match(adapter, /Send to client|onSend/);
  });

  it("does not leave CCY or Send to Client as peer controls on the creators row", () => {
    assert.doesNotMatch(workspace, /CommercialCurrencySelect/);
    assert.doesNotMatch(workspace, /ClientWorkspaceDisplayToggles/);
    assert.doesNotMatch(workspace, /ShortlistCreatorToolbarActions/);
    assert.doesNotMatch(workspace, />Send to Client</);
  });

  it("preserves bulk actions and permission gates in the compact selection bar", () => {
    for (const label of ["Submit selected", "Compare", "Refresh metrics", "Export CSV", "Generate quotation", "Send to client", "Remove from shortlist"]) assert.ok(bulk.includes(label), label);
    assert.match(bulk, /!p.canManage/);
    assert.match(bulk, /!a.eligible/);
    assert.match(bulk, /selectedCount < 2/);
  });
});
