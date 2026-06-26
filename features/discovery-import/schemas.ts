import { z } from "zod";

import { CREATOR_IMPORT_FILE_EXTENSIONS } from "./types";

const extensionPattern = new RegExp(
  `(${CREATOR_IMPORT_FILE_EXTENSIONS.map((ext) => ext.replace(".", "\\.")).join("|")})$`,
  "i"
);

export const uploadCreatorImportSchema = z.object({
  source_name: z.string().trim().max(200).optional(),
});

export function inferCreatorImportFileType(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".zip")) return "zip";
  return null;
}

export function isAllowedCreatorImportFilename(filename: string): boolean {
  return extensionPattern.test(filename.trim());
}
