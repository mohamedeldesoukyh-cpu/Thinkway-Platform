import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Default platform account ids when no dialog is needed. */
export function defaultPlatformAccountIds(creator: UnifiedCreatorResult): string[] {
  return sortPlatformsStable(creator.platforms).map((p) => p.id);
}

/** Whether the account selector dialog should appear before adding to shortlist. */
export function needsPlatformAccountSelection(creator: UnifiedCreatorResult): boolean {
  return sortPlatformsStable(creator.platforms).length > 1;
}
