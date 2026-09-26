import ExcelJS from "exceljs";
import { REVIEW_REPORT_CSS } from "./review-schedule-report-style";
import {
  scheduleDate,
  scheduleFinding,
  scheduleGroups,
  scheduleNeedsDecision,
  SCHEDULE_STATES,
  type ScheduleData,
} from "./review-schedule-model";

function esc(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function scheduleFilename(
  data: ScheduleData,
  extension: string,
  date: string,
) {
  const slug =
    data.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "campaign";
  return `${slug}-review-schedule-${date}.${extension}`;
}
export function scheduleReportHtml(data: ScheduleData, date: string) {
  const groups = scheduleGroups(data.rows),
    decisions = data.rows.filter(scheduleNeedsDecision).length;
  const sums = [
    ["Needs your decision", decisions, "review or approve"],
    ["With creators", data.rows.length - decisions, "includes completed work"],
    [
      "Total deliverables",
      data.rows.length,
      `across ${groups.length} creators`,
    ],
    [
      "Confirmed dates",
      data.rows.filter((r) => r.expected_review_date).length,
      `of ${data.rows.length}`,
    ],
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(data.name)} — Content review schedule</title><style>${REVIEW_REPORT_CSS}
  body{font-family:Arial,sans-serif} .t-ch{background:#fffbeb;color:#92400e}.t-ok{background:#ecf5ef;color:#47775e} .subtotal td{font-weight:bold;background:#f6f8fb} .sum{break-inside:avoid} td{overflow-wrap:anywhere} @media print{thead{display:table-header-group} tr{break-inside:avoid;page-break-inside:avoid} tr.grp{break-after:avoid;page-break-after:avoid}}
  </style></head><body><main class="pg"><div class="hd"><div><h1>Content review schedule</h1><p>${esc(data.name)} · ${esc(data.client_name)}<br>Campaign ${scheduleDate(data.start_date)} → ${scheduleDate(data.end_date)} · report generated ${scheduleDate(date)}</p></div><div class="brand"><b>THINKWAY</b>Creator content review<br>Client copy</div></div>
  <div class="sum">${sums.map(([label, note, detail]) => `<div><i>${label}</i><b>${note}</b><u>${detail}</u></div>`).join("")}</div><div class="flag">${scheduleFinding(data.rows)}</div>
  <table><thead><tr>${["Content type", "Ref", "Status", "Expected for review", "With", "Script", "Action"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${groups.map((group) => `<tr class="grp"><td colspan="7">${esc(group.name)} <b>${group.rows.length} deliverables</b></td></tr>${group.rows.map((row) => `<tr><td>${esc(row.content_type)}</td><td>${esc(row.ref)}</td><td><span class="t ${SCHEDULE_STATES[row.status].css.replace("u-", "t-")}">${SCHEDULE_STATES[row.status].label}</span></td><td class="c4">${scheduleDate(row.expected_review_date)}</td><td>${row.owner === "client" ? "Client" : "Creator"}</td><td>${row.has_script ? "Yes" : "No"}</td><td>${esc(row.action_label)}</td></tr>`).join("")}<tr class="subtotal"><td colspan="7">${group.rows.length} deliverables · ${group.rows.filter(scheduleNeedsDecision).length} need your decision · ${group.rows.filter((r) => r.has_script).length} scripts on file</td></tr>`).join("")}</tbody></table>
  <footer class="ft">Expected dates are for client review, not publication. Script availability is independent of status: a script on file does not necessarily need a decision. All statuses, including Approved and Changes requested, are included. “With” assigns pending decisions to Client and other rows to Creator; Approved is completed work.<br>Open the client workspace to view scripts and content. This report is a snapshot of the schedule on ${scheduleDate(date)}.</footer></main></body></html>`;
}

export async function scheduleWorkbook(data: ScheduleData, date: string) {
  const book = new ExcelJS.Workbook();
  book.creator = "Thinkway";
  book.calcProperties.fullCalcOnLoad = true;
  const sheet = book.addWorksheet("Schedule", {
      views: [
        { state: "frozen", ySplit: 7, topLeftCell: "A8", activeCell: "A8" },
      ],
    }),
    summary = book.addWorksheet("Summary");
  sheet.columns = [
    { width: 25 },
    { width: 23 },
    { width: 25 },
    { width: 10 },
    { width: 24 },
    { width: 25 },
    { width: 14 },
    { width: 10 },
    { width: 20 },
  ];
  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "Content review schedule";
  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = `${data.name} · ${data.client_name}`;
  sheet.mergeCells("A3:I3");
  sheet.getCell("A3").value =
    `Campaign ${scheduleDate(data.start_date)} → ${scheduleDate(data.end_date)} · report generated ${scheduleDate(date)}`;
  sheet.mergeCells("A5:I5");
  sheet.getCell("A5").value =
    "Expected dates are for client review, not publication. Script availability is independent of status.";
  sheet.getRow(7).values = [
    "Creator",
    "Handle",
    "Content type",
    "Ref",
    "Status",
    "Expected for review",
    "With",
    "Script",
    "Action",
  ];
  data.rows.forEach((r, i) => {
    sheet.getRow(i + 8).values = [
      r.creator_name,
      r.handle,
      r.content_type,
      r.ref,
      SCHEDULE_STATES[r.status].label,
      scheduleDate(r.expected_review_date),
      r.owner === "client" ? "Client" : "Creator",
      r.has_script ? "Yes" : "No",
      r.action_label,
    ];
  });
  const last = Math.max(8, 7 + data.rows.length);
  sheet.autoFilter = `A7:I${last}`;
  const range = (col: string) => `Schedule!$${col}$8:$${col}$${last}`;
  const literal = (value: string) =>
    `"${value.replace(/~/g, "~~").replace(/\*/g, "~*").replace(/\?/g, "~?").replace(/"/g, '""')}"`;
  summary.columns = [
    { width: 42 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "Summary";
  summary.mergeCells("A2:D2");
  summary.getCell("A2").value =
    `Source: Schedule tab, rows 8–${last}. Generated ${scheduleDate(date)}.`;
  const count = (
    label: string,
    formula: string,
    result: number,
    row: number,
  ) => {
    summary.getCell(`A${row}`).value = label;
    summary.getCell(`B${row}`).value = { formula, result };
  };
  count("Total deliverables", `COUNTA(${range("A")})`, data.rows.length, 4);
  count(
    "Needs your decision",
    `COUNTIF(${range("G")},"Client")`,
    data.rows.filter(scheduleNeedsDecision).length,
    5,
  );
  count(
    "With creators (includes completed)",
    `COUNTIF(${range("G")},"Creator")`,
    data.rows.filter((r) => r.owner === "creator").length,
    6,
  );
  count(
    "Confirmed review dates",
    `COUNTIFS(${range("F")},"<>To be confirmed",${range("A")},"<>")`,
    data.rows.filter((r) => r.expected_review_date).length,
    7,
  );
  count(
    "Scripts on file",
    `COUNTIF(${range("H")},"Yes")`,
    data.rows.filter((r) => r.has_script).length,
    8,
  );
  count(
    "…readable, no decision",
    `COUNTIFS(${range("H")},"Yes",${range("E")},"Awaiting content")`,
    data.rows.filter((r) => r.has_script && r.status === "awaiting_content")
      .length,
    9,
  );
  Object.entries(SCHEDULE_STATES).forEach(([status, info], i) =>
    count(
      info.label,
      `COUNTIF(${range("E")},${literal(info.label)})`,
      data.rows.filter((r) => r.status === status).length,
      11 + i,
    ),
  );
  summary.getRow(17).values = [
    "By creator",
    "Total",
    "With you",
    "With creator",
  ];
  scheduleGroups(data.rows).forEach((g, i) => {
    const row = summary.getRow(i + 18);
    row.values = [
      g.name,
      {
        formula: `COUNTIF(${range("B")},${literal(g.name)})`,
        result: g.rows.length,
      },
      {
        formula: `COUNTIFS(${range("B")},${literal(g.name)},${range("G")},"Client")`,
        result: g.rows.filter(scheduleNeedsDecision).length,
      },
      {
        formula: `COUNTIFS(${range("B")},${literal(g.name)},${range("G")},"Creator")`,
        result: g.rows.filter((r) => r.owner === "creator").length,
      },
    ];
  });
  for (const s of [sheet, summary]) {
    s.eachRow((row) => {
      row.height = 24;
      row.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, color: { argb: "FF0B0F1A" } };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
    });
    s.getRow(1).height = 32;
    s.getCell("A1").font = {
      name: "Arial",
      size: 18,
      bold: true,
      color: { argb: "FF0057FF" },
    };
    s.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  for (const [s, n] of [
    [sheet, 7],
    [summary, 17],
  ] as const)
    s.getRow(n).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEF3FF" },
      };
      cell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF0B2A6B" },
      };
    });
  data.rows.forEach((r, i) => {
    sheet.getCell(`F${i + 8}`).font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FF92400E" },
    };
    if (r.owner === "client")
      sheet.getCell(`G${i + 8}`).font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF0057FF" },
      };
  });
  sheet.pageSetup.printTitlesRow = "1:7";
  return book;
}
