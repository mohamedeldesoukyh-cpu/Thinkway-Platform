/**
 * Enterprise shortlist HTML — preview / Word / PDF share this renderer.
 */
import type { ShortlistDocument } from "./shortlist-document";
import {
  buildShortlistTemplateHtml,
  type BuildShortlistTemplateHtmlOptions,
} from "@/features/discovery/shortlists/templates/shortlist-template-html";

export type BuildShortlistHtmlOptions = BuildShortlistTemplateHtmlOptions;

export function buildShortlistHtml(
  doc: ShortlistDocument,
  options?: BuildShortlistHtmlOptions
): string {
  return buildShortlistTemplateHtml(doc, options);
}
