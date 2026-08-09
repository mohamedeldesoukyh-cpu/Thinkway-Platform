import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";

/** Confirmed Preview / Export selection from DocumentCreatorSelectionDialog. */
export type DocumentExportSelection = {
  itemIds: string[];
  /**
   * Platforms to include. `null` / omitted / empty means all platforms on the
   * selected creators (default).
   */
  platforms?: string[] | null;
};

export function parsePlatformsQueryParam(
  value: string | null | undefined
): string[] | undefined {
  if (!value?.trim()) return undefined;
  const platforms = value
    .split(",")
    .map((entry) => canonicalPlatformKey(entry.trim()))
    .filter(Boolean);
  return platforms.length > 0 ? [...new Set(platforms)] : undefined;
}

export function appendPlatformsQueryParam(
  params: URLSearchParams,
  platforms?: string[] | null
) {
  if (!platforms?.length) return;
  const normalized = sortPlatformsStable(
    platforms.map((platform) => ({ platform: canonicalPlatformKey(platform) }))
  ).map((entry) => entry.platform);
  if (normalized.length) params.set("platforms", normalized.join(","));
}

/** True when the caller selected a strict subset of available platforms. */
export function isPlatformSubset(
  selected: string[] | null | undefined,
  available: string[]
): boolean {
  if (!selected?.length) return false;
  if (available.length === 0) return false;
  const availableKeys = new Set(available.map((p) => canonicalPlatformKey(p)));
  const selectedKeys = [
    ...new Set(selected.map((p) => canonicalPlatformKey(p)).filter(Boolean)),
  ];
  if (selectedKeys.length === 0) return false;
  if (selectedKeys.length !== availableKeys.size) return true;
  return selectedKeys.some((key) => !availableKeys.has(key));
}

/**
 * Start a file download without navigating the current page.
 * Avoids `beforeunload` / “Leave app?” when the workspace has unsaved edits.
 */
export function triggerBrowserDownload(href: string) {
  if (typeof document === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
