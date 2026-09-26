import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import fixture from "./fixtures/review-schedule.json";
import { scheduleWorkbook } from "./review-schedule-export";
import {
  SCHEDULE_STATES,
  type ScheduleData,
  type ScheduleStatus,
} from "./review-schedule-model";

// Independent evaluator for the intentionally restricted export formula grammar.
// This runs in ordinary CI, without an Office installation or a formula cache.
function recalculate(formula: string, sheet: ExcelJS.Worksheet): number {
  const match = /^(COUNTA|COUNTIF|COUNTIFS)\((.*)\)$/.exec(formula);
  assert.ok(match, "Unsupported formula");
  const args = match[2].match(/"(?:[^"]|"")*"|[^,]+/g)!;
  const range = (s: string) => {
    const r = /^Schedule!\$([A-I])\$(\d+):\$\1\$(\d+)$/.exec(s);
    assert.ok(r);
    return Array.from(
      { length: Number(r[3]) - Number(r[2]) + 1 },
      (_, i) => sheet.getCell(`${r[1]}${Number(r[2]) + i}`).text,
    );
  };
  if (match[1] === "COUNTA") return range(args[0]).filter(Boolean).length;
  const criteria = [];
  for (let i = 0; i < args.length; i += 2) {
    const values = range(args[i]),
      criterion = args[i + 1].slice(1, -1).replace(/""/g, '"');
    const negated = criterion.startsWith("<>");
    const wanted = (negated ? criterion.slice(2) : criterion).replace(
      /~([~*?])/g,
      "$1",
    );
    criteria.push(values.map((v) => (negated ? v !== wanted : v === wanted)));
  }
  return criteria[0].filter((_, i) => criteria.every((c) => c[i])).length;
}
test("CI recalculates all 20 formulas from source cells, including after edits", async () => {
  const data = {
    campaignId: "fixture",
    name: "Fixture",
    client_name: "Client",
    start_date: null,
    end_date: null,
    rows: fixture.map((r, i) => ({
      id: String(i),
      creator_name: r[0],
      handle: r[1],
      content_type: r[2],
      ref: r[3],
      status: Object.keys(SCHEDULE_STATES).find(
        (k) => SCHEDULE_STATES[k as ScheduleStatus].label === r[4],
      ),
      expected_review_date: null,
      owner: r[6] === "Client" ? "client" : "creator",
      has_script: r[7] === "Yes",
      action_label: r[8],
    })),
  } as ScheduleData;
  const book = await scheduleWorkbook(data, "2026-09-26"),
    sheet = book.getWorksheet("Schedule")!,
    summary = book.getWorksheet("Summary")!;
  const xml = await (
    await JSZip.loadAsync(await book.xlsx.writeBuffer())
  )
    .file("xl/worksheets/sheet2.xml")!
    .async("string");
  let count = 0;
  summary.eachRow((row) =>
    row.eachCell((cell) => {
      if (!cell.formula) return;
      count++;
      const serialized = xml.match(
        new RegExp(`<c r="${cell.address}"[^>]*>[\\s\\S]*?<v>([^<]*)</v>`),
      );
      assert.ok(serialized);
      assert.equal(
        recalculate(cell.formula, sheet),
        Number(serialized[1]),
        cell.address,
      );
    }),
  );
  assert.equal(count, 20);
  sheet.getCell("G8").value = "Creator";
  sheet.getCell("E8").value = "Approved";
  assert.equal(recalculate(summary.getCell("B5").formula, sheet), 2);
  assert.equal(recalculate(summary.getCell("B6").formula, sheet), 47);
  assert.equal(recalculate(summary.getCell("B14").formula, sheet), 1);
  sheet.getCell("F9").value = "28 Sept 2026";
  assert.equal(recalculate(summary.getCell("B7").formula, sheet), 1);
});
