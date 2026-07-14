import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import type { MediaPlanCampaignContext, MediaPlanData } from "../generators/media-plan";
import { buildMediaPlanPreviewMarkup } from "../export/media-plan-html";
import { MEDIA_PLAN_BRAND } from "./media-plan-brand";

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
 * Media Plan uses the same HTML builder as PDF export for visual parity.
 */
export function OutputDocumentPreview({
  content,
  mediaPlanContextOverride,
}: {
  content: CampaignOutputContent;
  mediaPlanContextOverride?: MediaPlanCampaignContext;
}) {
  const mediaPlan = isMediaPlanData(content.data) ? content.data : undefined;

  if (mediaPlan) {
    const markup = buildMediaPlanPreviewMarkup(content, {
      contextOverride: mediaPlanContextOverride,
    });

    return (
      <div
        className="media-plan-html-preview mx-auto w-full max-w-[1280px] shadow-sm print:max-w-none print:shadow-none"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }

  return (
    <article className="mx-auto max-w-3xl bg-background px-8 py-10 shadow-sm">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{content.title}</h1>
        {content.summary ? (
          <p className="mt-2 text-sm text-muted-foreground">{content.summary}</p>
        ) : null}
      </header>

      <div className="space-y-6">
        {content.sections.map((section, i) => (
          <DocumentSection key={`${section.heading}-${i}`} section={section} />
        ))}
      </div>
    </article>
  );
}
