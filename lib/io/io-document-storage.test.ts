import assert from "node:assert/strict";

import {
  buildIoDocumentStoragePath,
  resolveIoDocumentStoragePath,
} from "@/lib/io/io-document-storage";

const bucket = "vendor-io-documents" as const;
const ioId = "550e8400-e29b-41d4-a716-446655440000";

assert.equal(
  buildIoDocumentStoragePath(ioId, "document.pdf"),
  `${ioId}/document.pdf`
);

assert.equal(
  resolveIoDocumentStoragePath(`${ioId}/document.pdf`, bucket),
  `${ioId}/document.pdf`
);

assert.equal(
  resolveIoDocumentStoragePath(
    `https://example.supabase.co/storage/v1/object/public/${bucket}/${ioId}/document.pdf`,
    bucket
  ),
  `${ioId}/document.pdf`
);

assert.equal(
  resolveIoDocumentStoragePath(
    `https://example.supabase.co/storage/v1/object/sign/${bucket}/${ioId}/document.pdf?token=abc`,
    bucket
  ),
  `${ioId}/document.pdf`
);

assert.equal(resolveIoDocumentStoragePath(null, bucket), null);
assert.equal(resolveIoDocumentStoragePath("https://evil.example/file.pdf", bucket), null);

console.log("io-document-storage.test.ts: all assertions passed");
