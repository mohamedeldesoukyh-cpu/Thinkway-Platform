import type { CreatorImportFileRow, CreatorImportStatus } from "./types";

export const CREATOR_IMPORT_POLL_INTERVAL_MS = 2500;

const TERMINAL_STATUSES = new Set<CreatorImportStatus>(["completed", "failed"]);

export function isTerminalCreatorImportStatus(status: CreatorImportStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function creatorImportFilesNeedPolling(files: CreatorImportFileRow[]): boolean {
  return files.some((file) => !isTerminalCreatorImportStatus(file.status));
}
