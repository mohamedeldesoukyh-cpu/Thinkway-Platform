/**
 * @deprecated Import from `@/components/shared/status/status-config` and `@/components/shared/status/status-utils`.
 * Re-exported for backward compatibility.
 */
export type {
  LegacyStatusTone as StatusTone,
  SemanticStatusTone,
} from "@/components/shared/status/status-config";
export {
  normalizeLegacyTone,
  resolveStatusBadgeClassName,
} from "@/components/shared/status/status-utils";

import type { LegacyStatusTone } from "@/components/shared/status/status-config";
import { resolveStatusBadgeClassName } from "@/components/shared/status/status-utils";

/** @deprecated Use resolveStatusBadgeClassName from status-utils. */
export const STATUS_TONE_CLASS: Record<LegacyStatusTone, string> = {
  neutral: resolveStatusBadgeClassName("neutral", "outline"),
  info: resolveStatusBadgeClassName("info", "outline"),
  success: resolveStatusBadgeClassName("success", "outline"),
  warning: resolveStatusBadgeClassName("warning", "outline"),
  danger: resolveStatusBadgeClassName("danger", "outline"),
  accent: resolveStatusBadgeClassName("accent", "outline"),
  foreground: resolveStatusBadgeClassName("foreground", "outline"),
  destructive: resolveStatusBadgeClassName("destructive", "outline"),
};
