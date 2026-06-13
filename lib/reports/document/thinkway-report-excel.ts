import {
  buildStyledExcelBuffer,
  type ColumnFormat,
  type DataRowKind,
  type HeaderMerge,
  type ReportHeaderBlock,
  type ReportMetaItem,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";

export type {
  ColumnFormat,
  DataRowKind,
  HeaderMerge,
  ReportHeaderBlock,
  ReportMetaItem,
  StyledDataRow,
  StyledSheetConfig,
};

/** @deprecated Use StyledSheetConfig with buildStyledExcelBuffer instead. */
export type ExcelSheetInput = {
  name: string;
  rows: (string | number | null)[][];
};

/**
 * Builds a styled Thinkway report workbook using exceljs.
 * Prefer this over the legacy unstyled path for all report exports.
 */
export { buildStyledExcelBuffer };
