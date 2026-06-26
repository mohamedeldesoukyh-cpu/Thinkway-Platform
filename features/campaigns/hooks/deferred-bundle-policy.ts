export type DeferredBundleStatus = "idle" | "loading" | "loaded" | "error";

/** Whether a deferred tab bundle should be fetched (skipped when already loaded unless forced). */
export function shouldFetchDeferredBundle(
  status: DeferredBundleStatus,
  options?: { force?: boolean }
): boolean {
  if (options?.force) return true;
  return status !== "loading" && status !== "loaded";
}

/** Force reload of an already-loaded bundle should not flash the tab loading skeleton. */
export function isSilentDeferredBundleRefresh(
  status: DeferredBundleStatus,
  options?: { force?: boolean }
): boolean {
  return options?.force === true && status === "loaded";
}
