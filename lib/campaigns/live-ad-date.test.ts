/**
 * Run: npx tsx lib/campaigns/live-ad-date.test.ts
 */
import {
  canEditLiveAdDate,
  formatLiveAdMonth,
  isLiveAdDateLocked,
  shouldApplyLiveAdDateLockOnInvoice,
} from "@/lib/campaigns/live-ad-date";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(formatLiveAdMonth("2026-03-15") === "Mar 26", "formats month and year");
assert(formatLiveAdMonth(null) === "—", "empty date shows dash");
assert(!isLiveAdDateLocked(null, "2026-01-01"), "no date means not locked");
assert(isLiveAdDateLocked("2026-03-01", "2026-01-01"), "date + locked_at is locked");
assert(canEditLiveAdDate(null, "2026-01-01"), "invoiced without date stays editable");
assert(!canEditLiveAdDate("2026-03-01", "2026-01-01"), "date set and locked is not editable");
assert(!shouldApplyLiveAdDateLockOnInvoice(null), "invoice without date skips lock");

console.log("live-ad-date.test.ts: ok");
