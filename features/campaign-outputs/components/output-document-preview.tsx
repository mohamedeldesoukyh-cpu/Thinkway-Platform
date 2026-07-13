import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import type { MediaPlanCampaignContext, MediaPlanData } from "../generators/media-plan";
import { MediaPlanCalendar } from "./media-plan-calendar";
import { MEDIA_PLAN_BRAND } from "./media-plan-brand";
import { mergeMediaPlanContext } from "./media-plan-context-merge";
import {
  MEDIA_PLAN_DEADLINES_HEADING,
  MediaPlanContextStrip,
  MediaPlanDeadlinesTable,
  shouldSkipMediaPlanSection,
} from "./media-plan-preview-sections";

function isMediaPlanData(data: unknown): data is MediaPlanData {
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as { weeks?: unknown }).weeks) &&
      typeof (data as { durationWeeks?: unknown }).durationWeeks === "number"
  );
}

function DocumentSection({ section }: { section: CampaignOutputContentSection }) {
  return (
    <section className="break-inside-avoid space-y-2 border-b border-border/60 pb-5 last:border-0">
      <h3
        className="text-sm font-extrabold uppercase tracking-[0.5px]"
        style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
      >
        {section.heading}
      </h3>
      {section.body ? (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{section.body}</p>
      ) : null}
      {section.items?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-foreground/90">
          {section.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.table ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-[12px]">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                {section.table.columns.map((col) => (
                  <th key={col} className="px-3 py-2 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border/60">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground/90">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Formatted document preview — print-ready layout for client review and export.
 * Media Plan uses landscape orientation to fit the weekly publishing calendar.
 */
export function OutputDocumentPreview({
  content,
  mediaPlanContextOverride,
}: {
  content: CampaignOutputContent;
  mediaPlanContextOverride?: MediaPlanCampaignContext;
}) {
  const mediaPlan = isMediaPlanData(content.data) ? content.data : undefined;
  const hasDeadlines = Boolean(mediaPlan?.deadlines?.length);
  const mediaPlanContext = mergeMediaPlanContext(
    mediaPlan?.campaignContext,
    mediaPlanContextOverride
  );

  return (
    <>
      {mediaPlan ? (
        <style>{`@media print { @page { size: landscape; margin: 10mm; } }`}</style>
      ) : null}
      <article
        className={
          mediaPlan
            ? "media-plan-landscape mx-auto w-full max-w-[1120px] px-6 py-8 shadow-sm print:max-w-none print:shadow-none"
            : "mx-auto max-w-3xl bg-background px-8 py-10 shadow-sm"
        }
        style={mediaPlan ? { backgroundColor: MEDIA_PLAN_BRAND.lavender } : undefined}
      >
        <header className="mb-8 overflow-hidden rounded-2xl border border-[#0B0F1A]/8 bg-white shadow-sm">
          <div className="h-1.5" style={{ background: MEDIA_PLAN_BRAND.gradient }} />
          <div className="px-6 py-5">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.35em]"
              style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
            >
              Thinkway
            </p>
            <h1
              className="mt-2 text-2xl font-extrabold tracking-tight"
              style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
            >
              {content.title}
            </h1>
            {content.summary ? (
              <p
                className="mt-2 text-[14px] leading-relaxed"
                style={{ color: MEDIA_PLAN_BRAND.muted }}
              >
                {content.summary}
              </p>
            ) : null}
            {mediaPlan ? <MediaPlanContextStrip context={mediaPlanContext} /> : null}
          </div>
        </header>

        {mediaPlan ? (
          <section className="mb-8 break-inside-avoid space-y-3">
            <h2
              className="text-sm font-extrabold uppercase tracking-[0.5px]"
              style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
            >
              Publishing Calendar
            </h2>
            <MediaPlanCalendar data={mediaPlan} orientation="landscape" />
          </section>
        ) : null}

        {mediaPlan && hasDeadlines ? (
          <section className="mb-8 break-inside-avoid space-y-3">
            <h2
              className="text-sm font-extrabold uppercase tracking-[0.5px]"
              style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
            >
              {MEDIA_PLAN_DEADLINES_HEADING}
            </h2>
            <MediaPlanDeadlinesTable deadlines={mediaPlan.deadlines} variant="document" />
          </section>
        ) : null}

        <div className="space-y-6">
          {content.sections
            .filter((s) => !mediaPlan || !shouldSkipMediaPlanSection(s.heading, hasDeadlines))
            .map((section, i) => (
              <DocumentSection key={`${section.heading}-${i}`} section={section} />
            ))}
        </div>
      </article>
    </>
  );
}
