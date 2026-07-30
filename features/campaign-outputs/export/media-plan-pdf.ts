import type { HtmlToPdfOptions } from "@/lib/io/vendor-io-pdf";

import { MEDIA_PLAN_PAGE } from "./media-plan-page";

/** Reference layout — 1280×780 viewport for PDF capture. */
export const MEDIA_PLAN_PDF_OPTIONS: HtmlToPdfOptions = {
  width: MEDIA_PLAN_PAGE.widthIn,
  height: MEDIA_PLAN_PAGE.heightIn,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
  viewport: {
    width: MEDIA_PLAN_PAGE.widthPx,
    height: MEDIA_PLAN_PAGE.heightPx,
    deviceScaleFactor: 1,
  },
  // Preview-style calendar/deadlines are auto-height; size each PDF sheet to the slide.
  sizeAutoHeightPages: {
    selector: ".page.calendar-preview-page, .page.deadlines-preview-page",
    widthPx: MEDIA_PLAN_PAGE.widthPx,
  },
};
