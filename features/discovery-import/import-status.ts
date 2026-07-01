import type { CreatorImportFileRow, CreatorImportStatus } from "./types";
import {
  CANCELLABLE_CREATOR_IMPORT_STATUSES,
  PAUSABLE_CREATOR_IMPORT_STATUSES,
  RESUMABLE_CREATOR_IMPORT_STATUSES,
} from "@/lib/discovery-import/constants";

export {
  CANCELLABLE_CREATOR_IMPORT_STATUSES,
  PAUSABLE_CREATOR_IMPORT_STATUSES,
  RESUMABLE_CREATOR_IMPORT_STATUSES,
};


export const CREATOR_IMPORT_POLL_INTERVAL_MS = 2500;

const TERMINAL_STATUSES = new Set<CreatorImportStatus>(["completed", "failed"]);

export function isTerminalCreatorImportStatus(status: CreatorImportStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isCancellableCreatorImportStatus(status: CreatorImportStatus): boolean {
  return (CANCELLABLE_CREATOR_IMPORT_STATUSES as readonly string[]).includes(status);
}

export function isPausableCreatorImportStatus(status: CreatorImportStatus): boolean {
  return (PAUSABLE_CREATOR_IMPORT_STATUSES as readonly string[]).includes(status);
}

export function isResumableCreatorImportStatus(status: CreatorImportStatus): boolean {
  return (RESUMABLE_CREATOR_IMPORT_STATUSES as readonly string[]).includes(status);
}


export function creatorImportFilesNeedPolling(files: CreatorImportFileRow[]): boolean {
  return files.some((file) => !isTerminalCreatorImportStatus(file.status));
}
