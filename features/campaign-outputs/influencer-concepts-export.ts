import type { InfluencerConcept } from "./influencer-concepts";
import {
  localizeCreatorCategory,
  resolveConceptLocaleFields,
  shouldShowProductionNotes,
} from "./influencer-concepts";

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w\u0600-\u06FF.-]+/g, "_").slice(0, 48);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Serialize concept for JSON export — valid JSON string. */
export function buildConceptJsonExport(concept: InfluencerConcept): string {
  return JSON.stringify(concept, null, 2);
}

export function buildAllConceptsJsonExport(concepts: InfluencerConcept[]): string {
  return JSON.stringify(concepts, null, 2);
}

export function downloadConceptJson(concept: InfluencerConcept): void {
  const title = sanitizeFilenamePart(resolveConceptLocaleFields(concept.english).conceptTitle);
  const blob = new Blob([buildConceptJsonExport(concept)], {
    type: "application/json;charset=utf-8",
  });
  triggerBlobDownload(blob, `${title || concept.id}.json`);
}

export function downloadAllConceptsJson(concepts: InfluencerConcept[]): void {
  const blob = new Blob([buildAllConceptsJsonExport(concepts)], {
    type: "application/json;charset=utf-8",
  });
  triggerBlobDownload(blob, `influencer-concepts-${concepts.length}.json`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function conceptFieldsForExport(
  concept: InfluencerConcept,
  locale: "en" | "ar"
): Array<[string, string]> {
  const content = resolveConceptLocaleFields(locale === "en" ? concept.english : concept.arabic);
  const rows: Array<[string, string | undefined]> =
    locale === "ar"
      ? [
          ["اسم المفهوم", content.conceptTitle],
          ["الهدف الإبداعي", content.creativeObjective],
          ["رحلة المبدع", content.creatorJourney],
          ["الخطاف الافتتاحي", content.openingHook],
          ["أنواع المبدعين", content.targetCreatorTypes.join(" · ")],
          ["المنصات", content.recommendedPlatforms.join(" · ")],
          ["المخرجات", content.suggestedDeliverables.join(" · ")],
          ["رد فعل الجمهور", content.expectedAudienceReaction],
          ["تسلسل القصة", content.storyFlow],
          ["الحوار", content.suggestedDialogue],
          ["نقاط الحديث", content.keyTalkingPoints.join(" · ")],
          ["الأسلوب البصري", content.visualStyle],
          ["توجيه الكاميرا", content.cameraDirection],
          ["الموسيقى", content.music],
          ["الانتقالات", content.transitions],
          ["قائمة اللقطات", content.suggestedShotList.join(" · ")],
          ["دمج العلامة", content.brandIntegration],
          ["دعوة للعمل", content.cta],
          ["الهاشتags", content.hashtags.join(" ")],
          ...(shouldShowProductionNotes(content.productionNotes)
            ? ([["ملاحظات الإنتاج", content.productionNotes]] as Array<[string, string | undefined]>)
            : []),
          ["ملاحظات الموافقة", content.approvalNotes],
          ["المدة", content.estimatedDuration],
        ]
      : [
          ["Concept Title", content.conceptTitle],
          ["Creative Objective", content.creativeObjective],
          ["Creator Journey", content.creatorJourney],
          ["Opening Hook", content.openingHook],
          ["Target Creator Types", content.targetCreatorTypes.join(" · ")],
          ["Platforms", content.recommendedPlatforms.join(" · ")],
          ["Deliverables", content.suggestedDeliverables.join(" · ")],
          ["Audience Reaction", content.expectedAudienceReaction],
          ["Story Flow", content.storyFlow],
          ["Dialogue", content.suggestedDialogue],
          ["Talking Points", content.keyTalkingPoints.join(" · ")],
          ["Visual Style", content.visualStyle],
          ["Camera Direction", content.cameraDirection],
          ["Music", content.music],
          ["Transitions", content.transitions],
          ["Shot List", content.suggestedShotList.join(" · ")],
          ["Brand Integration", content.brandIntegration],
          ["CTA", content.cta],
          ["Hashtags", content.hashtags.join(" ")],
          ...(shouldShowProductionNotes(content.productionNotes)
            ? ([["Production Notes", content.productionNotes]] as Array<[string, string | undefined]>)
            : []),
          ["Approval Notes", content.approvalNotes],
          ["Duration", content.estimatedDuration],
        ];

  const adaptations = Object.entries(content.creatorAdaptations)
    .filter(([, note]) => Boolean(note?.trim()))
    .map(
      ([category, note]) =>
        [`${localizeCreatorCategory(category, locale)}`, note!] as [string, string]
    );

  return [
    ...rows.filter(([, value]) => Boolean(value?.trim())) as Array<[string, string]>,
    ...adaptations,
  ];
}

function buildConceptHtmlDocument(
  concept: InfluencerConcept,
  locale: "en" | "ar"
): string {
  const content = resolveConceptLocaleFields(locale === "en" ? concept.english : concept.arabic);
  const dir = locale === "ar" ? ' dir="rtl"' : "";
  const title = escapeHtml(content.conceptTitle);
  const fields = conceptFieldsForExport(concept, locale)
    .map(
      ([label, value]) =>
        `<div class="field"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${locale}"${dir}>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #0B0F1A; }
    h1 { font-size: 1.25rem; margin-bottom: 1.5rem; }
    .field { margin-bottom: 1rem; }
    .label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #6B7280; letter-spacing: 0.04em; }
    .value { font-size: 0.875rem; line-height: 1.45; margin-top: 0.15rem; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${fields}
</body>
</html>`;
}

export function downloadConceptHtml(concept: InfluencerConcept, locale: "en" | "ar"): void {
  const title = sanitizeFilenamePart(
    resolveConceptLocaleFields(locale === "en" ? concept.english : concept.arabic).conceptTitle
  );
  const blob = new Blob([buildConceptHtmlDocument(concept, locale)], {
    type: "text/html;charset=utf-8",
  });
  triggerBlobDownload(blob, `${title || concept.id}-${locale}.html`);
}

export function downloadAllConceptsHtml(concepts: InfluencerConcept[], locale: "en" | "ar"): void {
  const dir = locale === "ar" ? ' dir="rtl"' : "";
  const sections = concepts
    .map((concept) => {
      const content = resolveConceptLocaleFields(
        locale === "en" ? concept.english : concept.arabic
      );
      const fields = conceptFieldsForExport(concept, locale)
        .map(
          ([label, value]) =>
            `<div class="field"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`
        )
        .join("");
      return `<section style="margin-bottom:2.5rem;padding-bottom:2rem;border-bottom:1px solid #E5E7EB;"><h2 style="font-size:1.1rem;margin-bottom:1rem;">${escapeHtml(content.conceptTitle)}</h2>${fields}</section>`;
    })
    .join("");
  const html = `<!DOCTYPE html>
<html lang="${locale}"${dir}>
<head>
  <meta charset="utf-8" />
  <title>Influencer Concepts</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #0B0F1A; }
    h1 { font-size: 1.25rem; margin-bottom: 1.5rem; }
    .field { margin-bottom: 1rem; }
    .label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #6B7280; }
    .value { font-size: 0.875rem; line-height: 1.45; margin-top: 0.15rem; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${locale === "ar" ? "مفاهيم المؤثرين" : "Influencer Concepts"} (${concepts.length})</h1>
  ${sections}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  triggerBlobDownload(blob, `influencer-concepts-${concepts.length}-${locale}.html`);
}
