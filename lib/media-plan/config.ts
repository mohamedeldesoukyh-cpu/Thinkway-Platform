/** Media Plan Engine — platform SSOT for scheduling versions and projections. */
export const MEDIA_PLAN_ENGINE_VERSION = "0.1.0";

/** Shown when Regenerate is visible but disabled (Locked / Approved*). */
export const MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE =
  "This Media Plan is locked or approved and cannot be regenerated. Create or continue a draft revision to make changes.";

/** Shown when a write targets an immutable approved baseline. */
export const MEDIA_PLAN_IMMUTABLE_BASELINE_MESSAGE =
  "Approved Media Plan versions are immutable. Create or continue a draft revision to make changes.";

/** Shown when a second concurrent draft would be created. */
export const MEDIA_PLAN_SINGLE_DRAFT_MESSAGE =
  "A working draft already exists. Continue editing that draft instead of creating another.";
