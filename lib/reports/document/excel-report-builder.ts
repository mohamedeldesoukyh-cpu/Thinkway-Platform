import { Workbook, type Cell, type Worksheet } from "exceljs";

import { neutralizeSpreadsheetFormula } from "@/lib/security/csv-formula";

/** Thinkway report palette (matches thinkway-report-styles.ts). */
const COLORS = {
  navy: "FF0A0F1E",
  white: "FFFFFFFF",
  blue: "FF0057FF",
  accentGreen: "FF1D9E75",
  emphasisBg: "FFE8F5F0",
  totalBg: "FFF3F4F6",
  ink: "FF1A1F36",
  muted: "FF6B7280",
} as const;

export type ReportMetaItem = {
  label: string;
  value: string;
};

export type ReportHeaderBlock = {
  /** Merged title row, e.g. "Thinkway — P&L Report". */
  title: string;
  meta?: ReportMetaItem[];
  /** Prominent entity line, e.g. "ACME — Acme Corporation". */
  entityLine?: string;
  generatedAt?: Date;
  notes?: string[];
};

export type ColumnFormat = "text" | "money" | "percent";

export type DataRowKind = "data" | "emphasis" | "total";

export type StyledDataRow = {
  values: (string | number | null)[];
  kind?: DataRowKind;
  richText?: Record<number, { text: string; secondary?: boolean }[]>;
};

/** Merge region relative to the column-header section (0-based). */
export type HeaderMerge = {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
};

export type StyledSheetConfig = {
  name: string;
  reportLayout?: boolean;
  columnWidths?: number[];
  header: ReportHeaderBlock;
  columnHeaders: (string | number | null)[][];
  headerMerges?: HeaderMerge[];
  rows: StyledDataRow[];
  columnFormats: ColumnFormat[];
  /** Zero-based columns shaded to distinguish accrual amounts. */
  accruedColumns?: number[];
  /** Zero-based combined-total columns, distinct from accruals. */
  totalColumns?: number[];
};

function formatGeneratedAt(date: Date): string {
  return `Generated ${date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  })}`;
}

function formatMetaLine(meta: ReportMetaItem[]): string {
  return meta.map((item) => `${item.label}: ${item.value}`).join("   |   ");
}

function columnCount(sheet: StyledSheetConfig): number {
  const fromHeaders = sheet.columnHeaders.reduce((max, row) => Math.max(max, row.length), 0);
  const fromRows = sheet.rows.reduce(
    (max, row) => Math.max(max, row.values.length),
    0
  );
  return Math.max(fromHeaders, fromRows, sheet.columnFormats.length);
}

function cellDisplayLength(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).length;
  }
  return String(value).length;
}

function applyTitleStyle(cell: Cell): void {
  cell.font = { name: "Calibri", size: 16, bold: true, color: { argb: COLORS.navy } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function applyMetaStyle(cell: Cell): void {
  cell.font = { name: "Calibri", size: 10, color: { argb: COLORS.muted } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}

function applyEntityStyle(cell: Cell): void {
  cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.ink } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}

function applyColumnHeaderStyle(cell: Cell): void {
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.white } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.navy },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.navy } },
    bottom: { style: "thin", color: { argb: COLORS.navy } },
    left: { style: "thin", color: { argb: COLORS.navy } },
    right: { style: "thin", color: { argb: COLORS.navy } },
  };
}

function applyDataCellStyle(
  cell: Cell,
  format: ColumnFormat,
  kind: DataRowKind
): void {
  const isEmphasis = kind === "emphasis";
  const isTotal = kind === "total";

  cell.font = {
    name: "Calibri",
    size: 10,
    bold: isEmphasis || isTotal,
    color: { argb: COLORS.ink },
  };

  if (isEmphasis) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.emphasisBg },
    };
  } else if (isTotal) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.totalBg },
    };
  }

  if (format === "percent") {
    cell.numFmt = "0.00%";
    cell.alignment = { vertical: "middle", horizontal: "right" };
  } else if (format === "money") {
    cell.numFmt = "#,##0.00";
    cell.alignment = { vertical: "middle", horizontal: "right" };
  } else {
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  }

  cell.border = {
    bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
  };
}

function buildTitleBlockRows(header: ReportHeaderBlock): string[] {
  const rows: string[] = [header.title];

  if (header.entityLine) {
    rows.push(header.entityLine);
  }

  if (header.meta && header.meta.length > 0) {
    rows.push(formatMetaLine(header.meta));
  }

  if (header.generatedAt) {
    rows.push(formatGeneratedAt(header.generatedAt));
  }

  if (header.notes) {
    for (const note of header.notes) {
      rows.push(note);
    }
  }

  return rows;
}

function titleBlockStyleForRow(
  header: ReportHeaderBlock,
  rowIndex: number
): "title" | "meta" | "entity" | "note" {
  if (rowIndex === 0) return "title";

  let index = 1;
  if (header.entityLine) {
    if (rowIndex === index) return "entity";
    index += 1;
  }
  if (header.meta && header.meta.length > 0) {
    if (rowIndex === index) return "meta";
    index += 1;
  }
  if (header.generatedAt) {
    if (rowIndex === index) return "meta";
    index += 1;
  }

  return "note";
}

function populateSheet(worksheet: Worksheet, sheet: StyledSheetConfig): void {
  const totalCols = columnCount(sheet);
  const titleRows = buildTitleBlockRows(sheet.header);
  const titleRowCount = titleRows.length;
  const spacerRow = titleRowCount;
  const headerStartRow = titleRowCount + 1;
  const dataStartRow = headerStartRow + sheet.columnHeaders.length;

  for (let rowIndex = 0; rowIndex < titleRowCount; rowIndex += 1) {
    const excelRow = worksheet.getRow(rowIndex + 1);
    const cell = excelRow.getCell(1);
    cell.value = neutralizeSpreadsheetFormula(titleRows[rowIndex]);

    const styleKind = titleBlockStyleForRow(sheet.header, rowIndex);
    if (styleKind === "title") {
      applyTitleStyle(cell);
    } else if (styleKind === "entity") {
      applyEntityStyle(cell);
    } else {
      applyMetaStyle(cell);
    }

    if (totalCols > 1) {
      worksheet.mergeCells(rowIndex + 1, 1, rowIndex + 1, totalCols);
    }
    excelRow.height = styleKind === "title" ? 28 : styleKind === "entity" ? 22 : 18;
  }

  const spacerExcelRow = worksheet.getRow(spacerRow + 1);
  spacerExcelRow.height = 8;

  for (let headerIndex = 0; headerIndex < sheet.columnHeaders.length; headerIndex += 1) {
    const excelRowIndex = headerStartRow + headerIndex + 1;
    const excelRow = worksheet.getRow(excelRowIndex);
    const headerRow = sheet.columnHeaders[headerIndex]!;

    for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
      const cell = excelRow.getCell(colIndex + 1);
      const value = headerRow[colIndex];
      cell.value =
        value === null || value === undefined
          ? ""
          : neutralizeSpreadsheetFormula(value);
      applyColumnHeaderStyle(cell);
      if (sheet.reportLayout) cell.border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FFD1D5DB" } }]));
      if (sheet.totalColumns?.includes(colIndex)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
        cell.font = { ...cell.font, bold: true, color: { argb: "FF082F49" } };
      }
      if (sheet.accruedColumns?.includes(colIndex)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
        cell.font = { ...cell.font, color: { argb: "FF451A03" } };
      }
    }

    excelRow.height = sheet.reportLayout ? 26 : 22;
  }

  if (sheet.headerMerges) {
    for (const merge of sheet.headerMerges) {
      const startRow = headerStartRow + merge.row + 1;
      const startCol = merge.col + 1;
      const endRow = startRow + merge.rowSpan - 1;
      const endCol = startCol + merge.colSpan - 1;
      worksheet.mergeCells(startRow, startCol, endRow, endCol);
    }
  }

  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
    const dataRow = sheet.rows[rowIndex]!;
    const excelRowIndex = dataStartRow + rowIndex + 1;
    const excelRow = worksheet.getRow(excelRowIndex);
    const kind = dataRow.kind ?? "data";

    for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
      const cell = excelRow.getCell(colIndex + 1);
      const raw = dataRow.values[colIndex];
      const format = sheet.columnFormats[colIndex] ?? "text";

      if (raw === null || raw === undefined || raw === "") {
        cell.value = "";
      } else if (format === "percent" && typeof raw === "number") {
        cell.value = raw / 100;
      } else if (format === "money" && typeof raw === "number") {
        cell.value = raw;
      } else if (typeof raw === "number") {
        cell.value = raw;
      } else {
        cell.value = neutralizeSpreadsheetFormula(raw);
      }

      applyDataCellStyle(cell, format, kind);
      if (sheet.reportLayout) {
        cell.border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FFD1D5DB" } }]));
        cell.alignment = { ...cell.alignment, vertical: "top" };
      }
      if (dataRow.richText?.[colIndex]) cell.value = { richText: dataRow.richText[colIndex].map(run => ({ text: run.text, font: { name: "Calibri", size: run.secondary ? 9 : 10, color: { argb: run.secondary ? COLORS.muted : COLORS.ink } } })) };
      if (sheet.totalColumns?.includes(colIndex)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FF" } };
        cell.font = { ...cell.font, bold: true, color: { argb: "FF082F49" } };
      }
      if (sheet.accruedColumns?.includes(colIndex)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
      }
    }

    excelRow.height = kind === "emphasis" ? 20 : 18;
  }

  const colWidths: number[] = Array.from({ length: totalCols }, () => 10);

  const scanRows = [
    ...(sheet.reportLayout ? [] : titleRows.map((value) => [value])),
    ...sheet.columnHeaders,
    ...sheet.rows.map((row) => row.values),
  ];

  for (const row of scanRows) {
    for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
      const format = sheet.columnFormats[colIndex] ?? "text";
      const len = cellDisplayLength(row[colIndex]);
      const padding = format === "money" || format === "percent" ? 4 : 2;
      const minWidth = format === "money" ? 14 : format === "percent" ? 10 : 8;
      colWidths[colIndex] = Math.max(colWidths[colIndex]!, Math.min(len + padding, 48), minWidth);
    }
  }

  for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
    worksheet.getColumn(colIndex + 1).width = sheet.columnWidths?.[colIndex] ?? colWidths[colIndex];
  }

  if (sheet.reportLayout) {
    sheet.rows.forEach((row, index) => {
      const lines = Math.max(1, ...row.values.map((value, col) => {
        if (typeof value !== "string") return 1;
        const capacity = Math.max(4, (worksheet.getColumn(col + 1).width ?? 12) - 1);
        return value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length * 0.9 / capacity)), 0);
      }));
      worksheet.getRow(dataStartRow + index + 1).height = Math.min(409, Math.max(17, lines * 12.5 + 2));
    });
    worksheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, showGridLines: false, margins: { left: .25, right: .25, top: .35, bottom: .35, header: .15, footer: .15 } };
    worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(totalCols).letter}${worksheet.rowCount}`;
    worksheet.pageSetup.printTitlesRow = `${headerStartRow + 1}:${dataStartRow}`;
  }
  const freezeRow = dataStartRow;
  worksheet.views = [
    {
      state: "frozen",
      ySplit: freezeRow,
      activeCell: `A${freezeRow + 1}`,
      showGridLines: !sheet.reportLayout,
      zoomScale: sheet.reportLayout ? 85 : 100,
    },
  ];
}

export async function buildStyledExcelBuffer(sheets: StyledSheetConfig[]): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = "Thinkway";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const safeName = sheet.name.slice(0, 31);
    const worksheet = workbook.addWorksheet(safeName);
    populateSheet(worksheet, sheet);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
