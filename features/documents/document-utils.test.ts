import assert from "node:assert/strict";

import {
  createEntityUploadHandler,
  documentExpiryStatus,
  formatDocumentDate,
  getDocumentFilterAccessors,
  getDocumentTypeOptions,
  isDocumentExpired,
  isDocumentExpiringSoon,
  isPreviewableMimeType,
  mapEntityDocumentUploadFormData,
  resolveDocumentTypeLabel,
  sortDocumentsByCreatedAt,
} from "./document-utils";
import { CLIENT_DOCUMENT_TYPE_OPTIONS } from "@/features/clients/constants";

async function main() {
  assert.equal(formatDocumentDate("2026-06-19T00:00:00.000Z"), "Jun 19, 2026");
  assert.equal(formatDocumentDate(null), "—");

  assert.equal(
    resolveDocumentTypeLabel("trade_license", CLIENT_DOCUMENT_TYPE_OPTIONS),
    "Trade License / CR"
  );

  assert.ok(getDocumentTypeOptions("client").length > 0);
  assert.ok(getDocumentTypeOptions("vendor").length > 0);
  assert.ok(getDocumentTypeOptions("group").length > 0);
  assert.ok(getDocumentFilterAccessors("client").type);
  assert.ok(getDocumentFilterAccessors("vendor").type);
  assert.ok(getDocumentFilterAccessors("group").type);

  const source = new FormData();
  source.set("document_type", "nda");
  source.set("expires_at", "2027-01-01");
  source.set("file", new Blob(["x"], { type: "application/pdf" }), "test.pdf");

  const mapped = mapEntityDocumentUploadFormData(
    { entityKind: "client", entityIdField: "client_id" },
    "client-1",
    source
  );
  assert.equal(mapped.get("client_id"), "client-1");
  assert.equal(mapped.get("document_type"), "nda");
  assert.equal(mapped.get("expires_at"), "2027-01-01");
  assert.ok(mapped.get("file"));

  let received: FormData | null = null;
  const handler = createEntityUploadHandler({
    entityKind: "client",
    entityIdField: "client_id",
    uploadViaApi: async (_entityId, formData) => {
      received = formData;
      return { ok: true, message: "Uploaded." };
    },
  });
  assert.ok(handler);
  const formData = new FormData();
  formData.set("entity_id", "abc");
  formData.set("document_type", "tax_document");
  const uploadResult = await handler!("abc", formData);
  assert.equal(uploadResult.ok, true);
  assert.equal(received!.get("client_id"), "abc");

  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);
  const futureIso = future.toISOString().slice(0, 10);
  assert.equal(isDocumentExpired(futureIso), false);
  assert.equal(documentExpiryStatus(futureIso), "valid");

  const past = "2020-01-01";
  assert.equal(isDocumentExpired(past), true);
  assert.equal(documentExpiryStatus(past), "expired");
  assert.equal(documentExpiryStatus(null), "none");

  const soon = new Date();
  soon.setDate(soon.getDate() + 5);
  const soonIso = soon.toISOString().slice(0, 10);
  assert.equal(isDocumentExpiringSoon(soonIso), true);
  assert.equal(documentExpiryStatus(soonIso), "expiring");

  assert.equal(isPreviewableMimeType("application/pdf"), true);
  assert.equal(isPreviewableMimeType("image/png"), true);
  assert.equal(isPreviewableMimeType("application/zip"), false);
  assert.equal(isPreviewableMimeType(null), false);

  const sorted = sortDocumentsByCreatedAt([
    {
      id: "1",
      document_type: "nda",
      file_name: "a.pdf",
      storage_path: "a",
      mime_type: null,
      expires_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "2",
      document_type: "nda",
      file_name: "b.pdf",
      storage_path: "b",
      mime_type: null,
      expires_at: null,
      created_at: "2026-06-01T00:00:00.000Z",
    },
  ]);
  assert.equal(sorted[0]?.id, "2");

  console.log("document-utils.test.ts passed");
}

void main();
