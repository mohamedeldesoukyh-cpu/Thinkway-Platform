import assert from "node:assert/strict";

import {
  extractPublicationDateFromHtml,
  extractPublicationDateFromProviderRow,
  normalizePublicationDate,
} from "@/lib/performance/metrics-collector/extract-publication-date";

assert.equal(normalizePublicationDate("2024-06-15T12:00:00.000Z"), "2024-06-15");
assert.equal(normalizePublicationDate("2024-06-15"), "2024-06-15");
assert.equal(normalizePublicationDate(1718452800), "2024-06-15");
assert.equal(normalizePublicationDate(1718452800000), "2024-06-15");
assert.equal(normalizePublicationDate(null), null);
assert.equal(normalizePublicationDate(""), null);

assert.equal(
  extractPublicationDateFromProviderRow({ publishedAt: "2024-03-01T08:00:00Z" }),
  "2024-03-01"
);
assert.equal(
  extractPublicationDateFromProviderRow({ taken_at_timestamp: 1718452800 }),
  "2024-06-15"
);
assert.equal(
  extractPublicationDateFromProviderRow({ createTimeISO: "2023-09-14T01:43:24.000Z" }),
  "2023-09-14"
);
assert.equal(
  extractPublicationDateFromProviderRow({
    playCount: 55700,
    diggCount: 5344,
    createTimeISO: "2025-08-02T18:45:03.000Z",
  }),
  "2025-08-02"
);
assert.equal(
  extractPublicationDateFromProviderRow({ createTime: 1756403075 }),
  "2025-08-28"
);
assert.equal(
  extractPublicationDateFromProviderRow({ createTime: "1756403075" }),
  "2025-08-28"
);
assert.equal(
  extractPublicationDateFromProviderRow({
    videoMeta: { createTime: 1754483302 },
  }),
  "2025-08-06"
);

const tiktokHtml =
  '{"playCount":1488,"diggCount":154,"createTime":1676464688,"createTimeISO":"2023-02-15T12:38:08.000Z"}';
assert.equal(extractPublicationDateFromHtml("tiktok", tiktokHtml), "2023-02-15");

const tiktokSigiHtml = `<script type="application/json" id="SIGI_STATE">{"ItemModule":{"123":{"createTime":1676464688,"createTimeISO":"2023-02-15T12:38:08.000Z"}}}</script>`;
assert.equal(extractPublicationDateFromHtml("tiktok", tiktokSigiHtml), "2023-02-15");

assert.equal(
  extractPublicationDateFromHtml("tiktok", '{"playCount":100,"diggCount":5}'),
  null
);

assert.equal(extractPublicationDateFromProviderRow({ likes: 100 }), null);
assert.equal(extractPublicationDateFromProviderRow(null), null);

console.log("extract-publication-date.test.ts: ok");
