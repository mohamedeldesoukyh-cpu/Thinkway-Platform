import { isServerActionDecodeError } from "@/lib/clients/client-document-utils";

export type AssignmentGridFlushResult =
  | { ok: true }
  | { ok: false; message: string };

export type AssignmentGridFlushFn = () => Promise<AssignmentGridFlushResult>;

const PROTOCOL_SAVE_MESSAGE =
  "Could not save this row. Wait a moment and click Save again.";

function flushFailureMessage(error: unknown): string {
  if (isServerActionDecodeError(error)) {
    return PROTOCOL_SAVE_MESSAGE;
  }
  return error instanceof Error ? error.message : "Failed to save.";
}

async function runAssignmentGridFlush(
  flush: AssignmentGridFlushFn
): Promise<AssignmentGridFlushResult> {
  try {
    return await flush();
  } catch (error) {
    if (!isServerActionDecodeError(error)) {
      return { ok: false, message: flushFailureMessage(error) };
    }
    try {
      return await flush();
    } catch (retryError) {
      return { ok: false, message: flushFailureMessage(retryError) };
    }
  }
}

/** Sequential so parallel server actions cannot collide on the same campaign revalidate. */
export async function runAssignmentGridFlushes(
  flushes: Iterable<AssignmentGridFlushFn>
): Promise<AssignmentGridFlushResult[]> {
  const results: AssignmentGridFlushResult[] = [];
  for (const flush of flushes) {
    results.push(await runAssignmentGridFlush(flush));
  }
  return results;
}

export function assignmentGridSaveErrorMessage(
  errors: Array<{ message: string }>
): string {
  const first = errors[0]?.message ?? "Failed to save assignments.";
  if (errors.length <= 1) return first;
  return `${errors.length} rows failed to save. ${first}`;
}
