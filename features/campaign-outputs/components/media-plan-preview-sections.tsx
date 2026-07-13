import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import type { MediaPlanCampaignContext, MediaPlanDeadline } from "../generators/media-plan";
import { MEDIA_PLAN_BRAND } from "./media-plan-brand";

export const MEDIA_PLAN_DEADLINES_HEADING = "Production & Asset Delivery Deadlines";

export function MediaPlanContextStrip({ context }: { context?: MediaPlanCampaignContext }) {
  if (!context?.brandName && !context?.groupName && !context?.agencyName) {
    return null;
  }

  const fields = [
    context.groupName ? { label: "Group", value: context.groupName } : null,
    context.brandName ? { label: "Brand", value: context.brandName } : null,
    context.agencyName ? { label: "Agency", value: context.agencyName } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#0B0F1A]/8 pt-4">
      {fields.map(({ label, value }) => (
        <div key={label}>
          <dt
            className="text-[10px] font-extrabold uppercase tracking-[0.5px]"
            style={{ color: MEDIA_PLAN_BRAND.muted }}
          >
            {label}
          </dt>
          <dd
            className="mt-0.5 text-[13px] font-semibold"
            style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MediaPlanDeadlinesTable({
  deadlines,
  variant = "document",
}: {
  deadlines: MediaPlanDeadline[];
  variant?: "document" | "inline";
}) {
  if (!deadlines.length) return null;

  const tableClass =
    variant === "document"
      ? "w-full min-w-[32rem] border-collapse text-[12px]"
      : "w-full min-w-[32rem] border-collapse text-[12px]";
  const wrapperClass =
    variant === "document"
      ? "overflow-x-auto rounded-xl border border-[#0B0F1A]/8 bg-white shadow-sm"
      : "overflow-x-auto rounded-lg border border-border";

  return (
    <div className={wrapperClass}>
      <table className={tableClass}>
        <thead>
          <tr
            className="text-left"
            style={{
              backgroundColor: `${MEDIA_PLAN_BRAND.lavender}`,
              color: MEDIA_PLAN_BRAND.deepNavy,
            }}
          >
            {["Creator", "Publish", "Production starts", "Assets due"].map((col) => (
              <th key={col} className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.5px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deadlines.map((deadline, index) => (
            <tr
              key={`${deadline.creator}-${deadline.publishWeek}-${deadline.publishDay}-${index}`}
              className="border-t border-[#0B0F1A]/8"
            >
              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CreatorAvatarImage
                    avatarUrl={deadline.avatarUrl ?? null}
                    profileUrl={deadline.profileUrl ?? null}
                    size="sm"
                    className="shrink-0 ring-1 ring-[#0B0F1A]/8"
                    alt={deadline.shortName ?? deadline.creator}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate font-semibold"
                      style={{ color: MEDIA_PLAN_BRAND.ink }}
                    >
                      {deadline.shortName ?? deadline.creator}
                    </p>
                    {deadline.handle ? (
                      <p className="truncate text-[10px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                        @{deadline.handle.replace(/^@/, "")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                Week {deadline.publishWeek} · {deadline.publishDay}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {deadline.productionStart}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {deadline.assetDelivery}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function shouldSkipMediaPlanSection(heading: string, hasDeadlinesData: boolean): boolean {
  if (heading.startsWith("Week ")) return true;
  if (hasDeadlinesData && heading === MEDIA_PLAN_DEADLINES_HEADING) return true;
  return false;
}
