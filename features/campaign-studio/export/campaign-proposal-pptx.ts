import type { CampaignObject } from "@/features/campaign-intelligence";
import type { SlateCreatorInput } from "../services/campaign-render-model";
import {
  buildCampaignProposalModel,
  type CampaignProposalModel,
  type ProposalSection,
} from "./campaign-proposal-model";

/**
 * PowerPoint export for the campaign proposal. Slides are derived from the
 * same CampaignProposalModel as the PDF, guaranteeing both client
 * deliverables render identical campaign facts. The slide model is pure data
 * (testable without pptxgenjs); rendering happens in exportCampaignProposalPptx.
 */

export type ProposalSlide = {
  title: string;
  subtitle?: string;
  bullets: string[];
  table?: { headers: string[]; rows: string[][] };
  note?: string;
  isCover?: boolean;
};

const MAX_TABLE_ROWS_PER_SLIDE = 10;

function sectionToSlides(section: ProposalSection): ProposalSlide[] {
  switch (section.kind) {
    case "keyValue":
      return [
        {
          title: section.title,
          bullets: [],
          table: {
            headers: ["Field", "Detail"],
            rows: section.items.map((item) => [item.label, item.value]),
          },
        },
      ];
    case "text":
      return [
        {
          title: section.title,
          bullets: [...section.paragraphs, ...(section.bullets ?? [])],
        },
      ];
    case "table": {
      if (section.rows.length === 0) {
        return [
          {
            title: section.title,
            bullets: section.note ? [section.note] : [],
          },
        ];
      }
      const slides: ProposalSlide[] = [];
      for (let offset = 0; offset < section.rows.length; offset += MAX_TABLE_ROWS_PER_SLIDE) {
        const chunk = section.rows.slice(offset, offset + MAX_TABLE_ROWS_PER_SLIDE);
        slides.push({
          title:
            offset === 0 ? section.title : `${section.title} (continued)`,
          bullets: [],
          table: { headers: section.headers, rows: chunk },
          note: offset + MAX_TABLE_ROWS_PER_SLIDE >= section.rows.length ? section.note : undefined,
        });
      }
      return slides;
    }
    case "cards":
      return [
        {
          title: section.title,
          bullets: section.cards.flatMap((card) => [
            card.title,
            ...card.lines.map((line) => `    ${line}`),
          ]),
        },
      ];
  }
}

/** Pure slide model from the shared proposal model — used by tests and the renderer. */
export function buildProposalSlides(model: CampaignProposalModel): ProposalSlide[] {
  const cover: ProposalSlide = {
    title: model.campaignName,
    subtitle: `${model.preparedForLine} · ${model.dateLabel}`,
    bullets: [model.confidentialityNote],
    isCover: true,
  };
  return [cover, ...model.sections.flatMap(sectionToSlides)];
}

const NAVY = "1B2A4A";
const GREEN = "1D9E75";
const INK = "222222";
const MUTED = "6B7280";

/** Build and download the proposal as a .pptx file (browser only). */
export async function exportCampaignProposalPptx(
  campaignObject: CampaignObject,
  hydratedVendors: SlateCreatorInput[] = []
): Promise<void> {
  const model = buildCampaignProposalModel(campaignObject, hydratedVendors);
  const slides = buildProposalSlides(model);

  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Thinkway Platform";
  pptx.title = model.campaignName;

  for (const slide of slides) {
    const s = pptx.addSlide();

    if (slide.isCover) {
      s.background = { color: NAVY };
      s.addText("Thinkway · Campaign Intelligence", {
        x: 0.6, y: 0.6, w: 9, h: 0.4,
        fontSize: 12, color: GREEN, bold: true, charSpacing: 2,
      });
      s.addText(slide.title, {
        x: 0.6, y: 1.6, w: 9, h: 1.2,
        fontSize: 34, color: "FFFFFF", bold: true,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.6, y: 2.9, w: 9, h: 0.5,
          fontSize: 13, color: "D9DEE8",
        });
      }
      s.addText(slide.bullets[0] ?? "", {
        x: 0.6, y: 4.9, w: 9, h: 0.4,
        fontSize: 10, color: "9AA3B5", italic: true,
      });
      continue;
    }

    s.addText(slide.title, {
      x: 0.5, y: 0.35, w: 9, h: 0.6,
      fontSize: 20, color: NAVY, bold: true,
    });

    let y = 1.1;
    if (slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((line) => ({
          text: line.trim(),
          options: {
            bullet: !line.startsWith("    "),
            indentLevel: line.startsWith("    ") ? 1 : 0,
            fontSize: 12,
            color: INK,
            breakLine: true,
          },
        })),
        { x: 0.5, y, w: 9, h: 3.9, valign: "top" }
      );
      y += 3.9;
    }

    if (slide.table) {
      const headerRow = slide.table.headers.map((header) => ({
        text: header,
        options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 10 },
      }));
      const bodyRows = slide.table.rows.map((row) =>
        row.map((cell) => ({ text: cell, options: { fontSize: 10, color: INK } }))
      );
      s.addTable([headerRow, ...bodyRows], {
        x: 0.5, y: 1.1, w: 9,
        border: { type: "solid", color: "E2E5EC", pt: 0.5 },
        autoPage: false,
      });
    }

    if (slide.note) {
      s.addText(slide.note, {
        x: 0.5, y: 5.0, w: 9, h: 0.35,
        fontSize: 9, color: MUTED, italic: true,
      });
    }
  }

  const fileName = `${model.campaignName.replace(/[^\w\s-]/g, "").trim() || "Campaign Proposal"}.pptx`;
  await pptx.writeFile({ fileName });
}
