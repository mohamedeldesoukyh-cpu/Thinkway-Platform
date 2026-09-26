import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import fixture from "./fixtures/review-schedule.json";
import { ReviewScheduleGrids } from "./components/review-schedule-grids";
import {
  emptyClientCampaignPerformance,
  type ClientCampaignPostRow,
} from "./campaign-execution";
import {
  scheduleAxis,
  scheduleCalendarDate,
  scheduleGroups,
  scheduleNeedsDecision,
  schedulePeriodKey,
  scheduleReadableOnly,
  scheduleRows,
  SCHEDULE_STATES,
  type ScheduleData,
  type ScheduleStatus,
} from "./review-schedule-model";
import {
  scheduleFilename,
  scheduleReportHtml,
  scheduleWorkbook,
} from "./review-schedule-export";
import type { ClientContentReviewItem } from "./content-approval";

test("missing campaign boundaries show a complete calendar month without inventing review dates", () => {
  const rows = [{ expected_review_date: "2026-09-28" }] as ScheduleData["rows"];
  const axis = scheduleAxis({ start_date: null, end_date: null, rows });
  assert.equal(axis.start, "2026-09-01");
  assert.equal(axis.end, "2026-09-30");
  assert.equal(axis.views.w.length, 5);
  assert.equal(rows[0].expected_review_date, "2026-09-28");
});

const post: ClientCampaignPostRow = {
  id: "p",
  creatorName: "Creator",
  platform: "instagram",
  platformLabel: "Instagram",
  deliverable: "Story",
  scheduledDate: null,
  status: "scheduled",
  live: false,
  publicationDate: null,
  contentUrl: null,
  performance: emptyClientCampaignPerformance(),
  assignmentDeliverableId: "d",
  quantity: 1,
};
test("undated delivered content uses receipt date without changing the expected date", () => {
  const row = { ...scheduleFixture.rows[0], expected_review_date: null, status: "ready_for_approval" as const,
    content: { uploadedAt: "2026-09-26T14:00:00Z" } as ClientContentReviewItem };
  assert.equal(scheduleCalendarDate(row), "2026-09-26");
  assert.equal(scheduleCalendarDate({ ...row, expected_review_date: "2026-09-28" }), "2026-09-28");
  assert.equal(scheduleCalendarDate({ ...row, content: null }), null);
  const axis = scheduleAxis({ start_date: "2026-09-28", end_date: "2026-09-30", rows: [row] });
  assert.equal(axis.start, "2026-09-26");
  const html = renderToStaticMarkup(<ReviewScheduleGrids rows={[row]} axis={axis} currentView="d" square={r => <i key={r.id} data-delivered="true" />} />);
  const daily = html.split('data-v="d"')[1].split('class="tbl"')[0];
  assert.match(daily, /26 Sept/);
  assert.equal((daily.match(/data-delivered=/g) || []).length, 1);
  assert.doesNotMatch(daily, /class="pool__u"><i/);
  assert.equal(row.expected_review_date, null);
});
test("daily view keeps exact review dates across month and leap-year boundaries", () => {
  const rows = [{ ...scheduleFixture.rows[0], expected_review_date: "2028-02-29" }];
  const axis = scheduleAxis({ start_date: "2028-02-28", end_date: "2028-03-01", rows });
  assert.deepEqual(axis.views.d.map(p => p.key), ["2028-02-28", "2028-02-29", "2028-03-01"]);
  assert.equal(axis.views.d[1].label, "29 Feb");
  assert.equal(schedulePeriodKey("2028-02-29", "d"), "2028-02-29");
  const html = renderToStaticMarkup(<ReviewScheduleGrids rows={rows} axis={axis} currentView="d" square={r => <i key={r.id} data-row={r.id} />} />);
  const daily = html.split('data-v="d"')[1].split('class="tbl"')[0];
  assert.match(daily, /Daily review schedule/);
  assert.match(daily, /29 Feb/);
  assert.equal((daily.match(/data-row=/g) || []).length, 1);
  assert.match(daily, /min-width:512px/);
});
export const scheduleFixture: ScheduleData = {
  campaignId: "fixture",
  name: "Limitless UAE August 2026",
  client_name: "Mind Share Egypt LTD · WPP Media",
  start_date: "2026-08-06",
  end_date: "2027-02-01",
  rows: fixture.map((r, i) => ({
    id: `r${i}`,
    creator_name: r[0],
    handle: r[1],
    content_type: r[2],
    ref: r[3],
    status: Object.keys(SCHEDULE_STATES).find(
      (k) => SCHEDULE_STATES[k as ScheduleStatus].label === r[4],
    ) as ScheduleStatus,
    expected_review_date: null,
    owner: r[6] === "Client" ? "client" : "creator",
    has_script: r[7] === "Yes",
    action_label: r[8],
    post,
    content: null,
  })),
};

test("49-row fixture retains every state and independent script presence", () => {
  const rows = scheduleFixture.rows;
  assert.equal(rows.length, 49);
  assert.equal(rows.filter(scheduleNeedsDecision).length, 3);
  assert.equal(rows.filter(scheduleReadableOnly).length, 1);
  assert.equal(rows.filter((r) => r.has_script).length, 4);
  assert.deepEqual(
    Object.keys(SCHEDULE_STATES).map(
      (k) => rows.filter((r) => r.status === k).length,
    ),
    [2, 1, 0, 0, 46],
  );
  assert.deepEqual(
    scheduleGroups(rows).map((g) => g.rows.length),
    [17, 31, 1],
  );
});
test("calendar views inherit a single track list and retain every square", () => {
  const axis = scheduleAxis(scheduleFixture);
  assert.equal(axis.defaultView, "m");
  assert.equal(axis.views.m.length, 7);
  assert.equal(axis.views.q.length, 3);
  // The reference's 26 weeks omits the final partial week (1 February). Correct ISO coverage is 27.
  assert.equal(axis.views.w.length, 27);
  assert.equal(schedulePeriodKey("2027-01-01", "w"), "2026-W53");
  assert.equal(schedulePeriodKey("2027-01-04", "w"), "2027-W01");
  const html = renderToStaticMarkup(
    <ReviewScheduleGrids
      rows={scheduleFixture.rows}
      axis={axis}
      currentView="m"
      square={(r) => (
        <i
          key={r.id}
          className={`u ${SCHEDULE_STATES[r.status].css}${r.has_script ? " has-s" : ""}`}
        />
      )}
    />,
  );
  assert.equal((html.match(/class="u /g) || []).length, 147);
  assert.equal((html.match(/--cols:/g) || []).length, 3);
  mkdirSync("tmp/review-schedule-check", { recursive: true });
  writeFileSync(
    "tmp/review-schedule-check/grid-preview.html",
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;margin:24px;background:#f6f8fb}.card{background:white;border:1px solid #e6ebf3;border-radius:16px}*{box-sizing:border-box}${readFileSync("features/client-workspace/styles/review-schedule.css", "utf8")}</style></head><body><section class="card rvs"><div class="rvs__h"><h2>Content review schedule</h2><div class="zoom"><button data-view="w">Weeks</button><button data-view="m">Months</button><button data-view="q">Quarters</button></div></div><p class="sub">49 deliverables · 3 creators · 6 Aug 2026 → 1 Feb 2027</p>${html}</section><script>document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>document.querySelectorAll('.tbl').forEach(g=>g.hidden=g.dataset.v!==b.dataset.view));</script></body></html>`,
  );
  for (const [v, n] of [
    ["w", 29],
    ["m", 9],
    ["q", 5],
  ] as const) {
    const fragment = html.split(`data-v="${v}"`)[1].split('class="tbl"')[0];
    const header = fragment.split('class="g hd"')[1].split("</div>")[0];
    assert.equal((header.match(/<span/g) || []).length, n);
    assert.equal((fragment.match(/class="u /g) || []).length, 49);
  }
});
test("confirmed dates use review dates and expand the axis without dropping items", () => {
  const data = {
    ...scheduleFixture,
    rows: scheduleFixture.rows.map((r, i) => ({
      ...r,
      expected_review_date: i === 0 ? "2027-03-02" : null,
    })),
  };
  const axis = scheduleAxis(data);
  assert.equal(axis.end, "2027-03-02");
  assert.equal(
    schedulePeriodKey(data.rows[0].expected_review_date!, "m"),
    "2027-03",
  );
  assert.equal(
    scheduleAxis({ ...data, end_date: "2028-02-01" }).defaultView,
    "q",
  );
  assert.equal(
    scheduleAxis({ ...data, rows: [], end_date: "2026-09-01" }).defaultView,
    "w",
  );
});
test("a readable script does not promote its draft to a client decision; completed and changes remain", () => {
  const rows = scheduleRows([post], [], new Set(["d:d"]));
  assert.equal(
    rows.find((r) => r.content_type === "Story")?.status,
    "awaiting_content",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows.filter(scheduleNeedsDecision).length, 0);
  assert.equal(rows.filter(scheduleReadableOnly).length, 1);
  const asset = {
    assetId: "a",
    versionId: "v",
    versionNumber: 1,
    assignmentDeliverableId: "d",
    assignmentPostScheduleId: null,
    status: "approved",
    uploadedAt: "2026-09-26",
  } as ClientContentReviewItem;
  const pending = scheduleRows([post], [{ ...asset, status: "approval_required" }], new Set(["d:d"]));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].has_script, true);
  assert.equal(pending.filter(scheduleNeedsDecision).length, 1);
  const report = scheduleReportHtml({ ...scheduleFixture, rows }, "2026-09-26");
  assert.equal((report.match(/<tr><td>/g) || []).length, 1);
  assert.doesNotMatch(report, /<td>Script<\/td>/);
  assert.equal(scheduleRows([post], [asset], new Set())[0].status, "approved");
  assert.equal(
    scheduleRows(
      [post],
      [{ ...asset, status: "changes_requested" }],
      new Set(),
    )[0].status,
    "changes_requested",
  );
  assert.equal(
    scheduleRows([{ ...post, live: true }], [], new Set())[0].status,
    "approved",
  );
});
test("HTML contains all rows, escaped text, and required print pagination", () => {
  const html = scheduleReportHtml(scheduleFixture, "2026-09-26");
  assert.equal((html.match(/<tr><td>/g) || []).length, 49);
  assert.match(html, /thead\{display:table-header-group\}/);
  assert.match(html, /page-break-inside:avoid/);
  assert.match(html, /page-break-after:avoid/);
  assert.match(
    scheduleReportHtml(
      { ...scheduleFixture, name: "<script>alert(1)</script>" },
      "2026-09-26",
    ),
    /&lt;script&gt;/,
  );
  assert.equal(
    scheduleFilename(scheduleFixture, "pdf", "2026-09-26"),
    "limitless-uae-august-2026-review-schedule-2026-09-26.pdf",
  );
});
test("Excel formulas retain cached results and reconcile the 49-row source", async () => {
  const book = await scheduleWorkbook(scheduleFixture, "2026-09-26"),
    file = await book.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(file);
  const sheet = read.getWorksheet("Schedule")!,
    summary = read.getWorksheet("Summary")!;
  assert.equal(sheet.rowCount, 56);
  assert.equal(sheet.columnCount, 9);
  assert.equal(sheet.autoFilter, "A7:I56");
  assert.equal(sheet.views[0].state, "frozen");
  let formulas = 0;
  summary.eachRow((row) =>
    row.eachCell((cell) => {
      const value = cell.value as ExcelJS.CellFormulaValue;
      if (value?.formula) {
        formulas++;
        assert.match(value.formula, /^(COUNTA|COUNTIF|COUNTIFS)\(/);
        assert.ok(
          value.result === undefined || typeof value.result === "number",
        );
        assert.doesNotMatch(value.formula, /\$57/);
      }
    }),
  );
  assert.equal(formulas, 20);
  const xml = await (
    await JSZip.loadAsync(file)
  )
    .file("xl/worksheets/sheet2.xml")!
    .async("string");
  assert.equal([...xml.matchAll(/<f>[^<]+<\/f><v>\d+<\/v>/g)].length, 20);
  assert.equal(summary.getCell("B4").result, 49);
  assert.equal(summary.getCell("B5").result, 3);
  assert.equal(summary.getCell("B6").result, 46);
  assert.equal(summary.getCell("B8").result, 4);
  assert.equal(summary.getCell("B9").result, 1);
  const dir = "tmp/review-schedule-check";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/schedule.xlsx`, Buffer.from(file));
  writeFileSync(
    `${dir}/schedule.html`,
    scheduleReportHtml(scheduleFixture, "2026-09-26"),
  );
});
test("all schedule selectors are scoped and download menu has exactly three formats", () => {
  const css = readFileSync(
    "features/client-workspace/styles/review-schedule.css",
    "utf8",
  );
  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    const selector = match[1].trim();
    if (selector.startsWith("@")) continue;
    for (const part of selector.split(","))
      assert.match(part.trim(), /^\.rvs(?:\s|$|[.:#\[])/);
  }
  const source = readFileSync(
    "features/client-workspace/components/content-review-schedule.tsx",
    "utf8",
  );
  assert.match(source, /\["pdf",\s*"PDF"/);
  assert.match(source, /\["xlsx",\s*"Excel"/);
  assert.match(source, /\["html",\s*"HTML"/);
  assert.match(source, /pointerdown/);
  assert.match(source, /aria-expanded/);
});
