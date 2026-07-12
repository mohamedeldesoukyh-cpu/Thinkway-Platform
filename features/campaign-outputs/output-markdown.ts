/**
 * Render a Campaign Output's structured content to Markdown — used for chat
 * export ("Export the Strategy") and as a uniform text representation for any
 * output, independent of the file-export pipeline.
 */

import type { CampaignOutputContent } from "./output-types";

export function renderOutputMarkdown(content: CampaignOutputContent): string {
  const lines: string[] = [`# ${content.title}`];
  if (content.summary) lines.push("", content.summary);

  for (const section of content.sections) {
    lines.push("", `## ${section.heading}`);
    if (section.body) lines.push("", section.body);
    if (section.items?.length) {
      lines.push("");
      for (const item of section.items) lines.push(`- ${item}`);
    }
    if (section.table) {
      lines.push("");
      lines.push(`| ${section.table.columns.join(" | ")} |`);
      lines.push(`| ${section.table.columns.map(() => "---").join(" | ")} |`);
      for (const row of section.table.rows) lines.push(`| ${row.join(" | ")} |`);
    }
  }

  return lines.join("\n");
}
