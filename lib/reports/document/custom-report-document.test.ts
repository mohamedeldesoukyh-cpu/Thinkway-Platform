import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { buildCustomReport } from "../custom/custom-report";
import { parseOverviewFilters } from "../overview/overview-report";
import { buildCustomReportHtml, buildCustomReportExcelBuffer, parseCustomDocumentColumns } from "./custom-report-document";

const report = buildCustomReport({ headers: [{ id: "c", name: "Campaign <script>alert(1)</script>", status: "active", start_date: null, currency_code: "EGP", client_id: null, brand_id: null, client: null, brand: null }], lines: [{ id: "l", campaign_header_id: "c", revenue_before_vat: 1000, cost_before_vat: 600, revenue_vat_amount: 140 }], deliverables: [], posts: [], publications: [], rates: new Map([["EGP", 1]]), filters: parseOverviewFilters({}) }, "EGP");
test("export selection preserves order, removes invalid duplicates and makes VAT opt in", () => {
  assert.deepEqual(parseCustomDocumentColumns(new URLSearchParams("columns=totalGp,campaign,totalGp,invalid,vat")), ["totalGp", "campaign"]);
  assert.deepEqual(parseCustomDocumentColumns(new URLSearchParams("columns=campaign&includeVat=1")), ["campaign", "vat"]);
  assert.deepEqual(parseCustomDocumentColumns(new URLSearchParams()), []);
});
test("standalone statement-style preview escapes labels and has matching download links", () => {
  const html = buildCustomReportHtml(report, ["campaign", "totalRevenue", "vat"], new URLSearchParams("columns=campaign,totalRevenue,vat&includeVat=1&currency=EGP"));
  assert.match(html, /class="band"/); assert.match(html, /class="foot"/);
  assert.match(html, /Campaign &lt;script&gt;/); assert.doesNotMatch(html, /Campaign <script>/);
  assert.match(html, /format=pdf/); assert.match(html, /format=xlsx/);
  assert.match(html, /includeVat=1/); assert.match(html, /data-custom-report-ready/);
  assert.match(html, /140.00/);
});
test("Excel retains numeric amounts, totals and selected column order", async () => {
  const workbook = new Workbook();
  await workbook.xlsx.load(await buildCustomReportExcelBuffer(report, ["campaign", "totalRevenue", "vat"]));
  const sheet = workbook.worksheets[0];
  let header = 0;
  sheet.eachRow((row, index) => { if (row.getCell(1).value === "Campaign Name") header = index; });
  assert.ok(header > 0);
  assert.equal(sheet.getCell(header, 2).value, "Total Rev.");
  assert.equal(sheet.getCell(header + 1, 2).value, 1000);
  assert.equal(sheet.getCell(header + 1, 3).value, 140);
  assert.equal(sheet.getCell(header + 2, 2).value, 1000);
});
test("Foreign workbook preserves currency labels instead of adding different currencies", async () => {
  const workbook = new Workbook();
  await workbook.xlsx.load(await buildCustomReportExcelBuffer({ ...report, currency: "Foreign" }, ["campaign", "totalRevenue"]));
  assert.ok(workbook.worksheets[0].getSheetValues().flat().includes("EGP 1,000.00"));
});

test("creator names and handles are escaped separately and internal explanations are omitted", () => {
  const detailed = { ...report, creatorDetail: true, filterLabels: ["Private filter"], rows: [{ ...report.rows[0], creatorIdentities: [{ name: "Name <b>", username: "@handle" }] }] };
  const html = buildCustomReportHtml(detailed, ["creator"], new URLSearchParams("reportName=My+Report"));
  assert.match(html, /Name &lt;b&gt;/);
  assert.match(html, /<small dir="ltr">@handle<\/small>/);
  assert.match(html, /<h1>My Report<\/h1>/);
  assert.doesNotMatch(html, /Actual &amp; accrued|Filters:|One row per creator|Actual = went-live/);
});

test("Excel report hides gridlines, fits multiline identities and keeps compact reference widths", async () => {
  const sample = { ...report, rows: [{ ...report.rows[0], creatorIdentities: [{ name: "A long creator display name that should wrap inside its column", username: "@creator_username" }] }] };
  const book = new Workbook();
  await book.xlsx.load(await buildCustomReportExcelBuffer(sample, ["campaignNumber", "creator", "totalRevenue"]));
  const sheet = book.worksheets[0];
  assert.equal(sheet.views[0].showGridLines, false);
  assert.notEqual(sheet.pageSetup.showGridLines, true);
  assert.equal(sheet.pageSetup.orientation, "landscape");
  assert.equal(sheet.getColumn(1).width, 16);
  let rowIndex = 0;
  sheet.eachRow((row, index) => { if (row.getCell(2).text.includes("@creator_username")) rowIndex = index; });
  assert.ok(sheet.getRow(rowIndex).height >= 54);
  const rich = sheet.getCell(rowIndex, 2).value as { richText: {font: {size: number}; text: string}[] };
  assert.equal(rich.richText[1].font.size, 9);
  assert.equal(sheet.getCell(rowIndex, 3).value, 1000);
  assert.ok(!sheet.getCell(rowIndex, 2).border?.bottom);
});
