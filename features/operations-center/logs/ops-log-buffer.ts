import type { LogCategory, LogSeverity, OpsLogEntry } from "../types";

const MAX_ENTRIES = 500;
const buffer: OpsLogEntry[] = [];
let seq = 0;

export type OpsLogWriteInput = {
  severity: LogSeverity;
  category: LogCategory;
  source: string;
  message: string;
  fields?: Record<string, unknown>;
};

export function writeOpsLog(input: OpsLogWriteInput): OpsLogEntry {
  const entry: OpsLogEntry = {
    id: `ops-log-${++seq}`,
    timestamp: new Date().toISOString(),
    ...input,
  };
  buffer.unshift(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.length = MAX_ENTRIES;
  }
  return entry;
}

export type OpsLogQuery = {
  category?: LogCategory;
  severity?: LogSeverity;
  source?: string;
  search?: string;
  limit?: number;
};

export function queryOpsLogs(query: OpsLogQuery = {}): OpsLogEntry[] {
  const limit = query.limit ?? 100;
  const search = query.search?.trim().toLowerCase();
  return buffer
    .filter((entry) => {
      if (query.category && entry.category !== query.category) return false;
      if (query.severity && entry.severity !== query.severity) return false;
      if (query.source && entry.source !== query.source) return false;
      if (search) {
        const hay = `${entry.message} ${entry.source}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    })
    .slice(0, limit);
}

export function resetOpsLogBuffer(): void {
  buffer.length = 0;
  seq = 0;
}
