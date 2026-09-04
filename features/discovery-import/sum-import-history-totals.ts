import type { CreatorImportFileRow } from "@/features/discovery-import/types";

/** Pack footer totals — always sum the live array, never hand-type the figures. */
export function sumImportHistoryTotals(files: CreatorImportFileRow[]) {
  return files.reduce(
    (acc, file) => {
      acc.creators += file.total_creators;
      acc.imported += file.imported_creators;
      acc.updated += file.updated_creators;
      acc.failed += file.failed_creators;
      if (file.status === "failed") acc.failedFiles += 1;
      if (
        file.status === "processing" ||
        file.status === "queued" ||
        file.status === "uploaded"
      ) {
        acc.processing += 1;
      }
      return acc;
    },
    {
      creators: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      failedFiles: 0,
      processing: 0,
    }
  );
}
