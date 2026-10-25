import test from "node:test";
import assert from "node:assert/strict";
import { omitReportPages, reportPages } from "./report-page-selection";
const source = '<html><head><style>.page{color:red}</style></head><body>' + [1,2,3].map(n => `<section class="page cover"><h1>Page ${n}</h1><footer><span>QT-1</span><s></s><span>${n} / 3</span></footer></section>`).join('') + '<script>/* pagination */</script></body></html>';
test("removes only selected pages, preserves assets and renumbers footers", () => {
 const html = omitReportPages(source, [1,3]);
 assert.equal(reportPages(html).length, 1);
 assert.ok(html.includes('<h1>Page 2</h1>'));
 assert.ok(html.includes('<span>1 / 1</span>'));
 assert.ok(html.includes('<style>.page{color:red}</style>'));
 assert.ok(html.includes('<script>/* pagination */</script>'));
});
test("undo and restore derive pages from the original without losing content", () => {
 assert.equal(reportPages(omitReportPages(source, [2,3])).length, 1);
 assert.equal(reportPages(omitReportPages(source, [2])).length, 2);
 assert.equal(omitReportPages(source, []), source);
});
test("retains a usable report when all pages are excluded and ignores invalid indices", () => {
 assert.equal(omitReportPages(source, [1,2,3]), source);
 assert.equal(omitReportPages(source, [-1,0,4,NaN]), source);
});
