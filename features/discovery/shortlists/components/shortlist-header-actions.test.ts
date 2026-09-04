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
  it("groups View on the title row and keeps one primary", () => {
    assert.match(workspace, /ShortlistHeaderActions/);
    assert.match(header, /aria-label="View settings"/);
    assert.match(header, /\+ Add creators/);
    assert.match(header, /Complete brief/);
    assert.match(header, /OpenCampaignStudioLauncher/);
    assert.match(header, /GenerateOutputsLauncher/);
    assert.match(header, /tone="toolbar"/);
  });

  it("uses shared Overlay F via shortlist adapter (Preview · Export · Client link · Send)", () => {
    assert.match(header, /ShortlistDocumentOutputToolbar/);
    assert.match(adapter, /DocumentOutputToolbar/);
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

  it("makes Submit the selection primary and keeps the five visible bulk actions", () => {
    assert.match(bulk, /Submit \$\{selectedCount\} selected/);
    const compareAt = bulk.indexOf('id: "compare"');
    const refreshAt = bulk.indexOf('id: "refresh-metrics"');
    const exportAt = bulk.indexOf('id: "export"');
    const quoteAt = bulk.indexOf('id: "quotation"');
    const sendAt = bulk.indexOf('id: "send-client"');
    assert.ok(compareAt > 0 && refreshAt > compareAt);
    assert.ok(exportAt > refreshAt && quoteAt > exportAt);
    assert.ok(sendAt > quoteAt);
  });
});
