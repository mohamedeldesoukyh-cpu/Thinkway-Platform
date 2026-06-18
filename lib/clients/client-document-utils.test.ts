import assert from "node:assert/strict";

import {
  friendlyClientDocumentError,
  isMissingClientDocumentsBucket,
  isMissingClientDocumentsRelation,
  serializeClientDocumentRow,
} from "./client-document-utils";

const baseRow = {
  id: "11111111-1111-1111-1111-111111111111",
  client_id: "22222222-2222-2222-2222-222222222222",
  document_type: "trade_license",
  file_name: "license.pdf",
  storage_path: "22222222-2222-2222-2222-222222222222/trade_license/file.pdf",
  mime_type: "application/pdf",
  file_size: 2048,
  expires_at: "2027-01-15",
  notes: null,
  uploaded_by: "33333333-3333-3333-3333-333333333333",
  created_at: "2026-06-19T00:00:00.000Z",
  updated_at: "2026-06-19T00:00:00.000Z",
};

const serialized = serializeClientDocumentRow(baseRow);
assert.equal(serialized.file_name, "license.pdf");
assert.equal(serialized.file_size, 2048);

const bigintSerialized = serializeClientDocumentRow({
  ...baseRow,
  file_size: BigInt(4096),
});
assert.equal(bigintSerialized.file_size, 4096);

const dateSerialized = serializeClientDocumentRow({
  ...baseRow,
  created_at: new Date("2026-06-19T00:00:00.000Z"),
  updated_at: new Date("2026-06-19T01:00:00.000Z"),
  expires_at: new Date("2027-01-15T00:00:00.000Z"),
});
assert.equal(dateSerialized.created_at, "2026-06-19T00:00:00.000Z");
assert.equal(dateSerialized.expires_at, "2027-01-15");

assert.equal(JSON.stringify(dateSerialized), JSON.stringify(dateSerialized));

assert.equal(
  isMissingClientDocumentsRelation('relation "client_documents" does not exist'),
  true
);
assert.equal(
  isMissingClientDocumentsBucket("Bucket client-documents not found"),
  true
);
assert.equal(
  friendlyClientDocumentError('relation "client_documents" does not exist'),
  "Document storage is not configured yet. Ask an admin to apply the client_documents migration."
);

console.log("client-document-utils.test.ts passed");
