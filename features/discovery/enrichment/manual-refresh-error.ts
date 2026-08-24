import { isMaskedServerActionError } from "@/lib/creators/discovery-search-error";

export const MANUAL_REFRESH_TIMEOUT_MESSAGE =
  "Metrics refresh timed out. The list is unchanged. Try again.";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function errorDigest(error: unknown): string {
  if (typeof error === "object" && error && "digest" in error) {
    return String((error as { digest?: unknown }).digest ?? "");
  }
  return "";
}

/** Redirect / notFound must still propagate; timeout digests must not. */
export function rethrowNextControlFlow(error: unknown): void {
  const digest = errorDigest(error);
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
    throw error;
  }
}

export function mapManualRefreshError(error: unknown): string {
  const message = errorMessage(error);
  const digest = errorDigest(error);
  if (
    isMaskedServerActionError(message) ||
    /FUNCTION_INVOCATION_TIMEOUT|task timed out|timed out/i.test(message) ||
    /FUNCTION_INVOCATION_TIMEOUT/i.test(digest)
  ) {
    return MANUAL_REFRESH_TIMEOUT_MESSAGE;
  }
  return message.trim() || "Could not refresh metrics.";
}

/**
 * Run a Refresh Metrics server action without throwing into a React error boundary.
 * React 19 reports uncaught `startTransition` / Server Action digest errors to
 * PlatformErrorBoundary and blanks the Discovery panel.
 */
export async function invokeRefreshAction<T extends { ok: boolean; queued: boolean; message: string }>(
  run: () => Promise<T>
): Promise<T | { ok: false; queued: false; message: string }> {
  try {
    return await run();
  } catch (error) {
    rethrowNextControlFlow(error);
    return {
      ok: false,
      queued: false,
      message: mapManualRefreshError(error),
    };
  }
}
