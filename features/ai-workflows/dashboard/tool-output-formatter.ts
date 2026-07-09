import {
  formatSearchResults,
  normalizeCreators,
  stripConversationalFiller,
} from "../formatters/creator-formatter";
import { MUTATING_TOOLS, READ_ONLY_TOOLS } from "../types/task";

/** All workflow-supported AI tool names (read-only + mutating). */
export const SUPPORTED_TOOL_NAMES = [...READ_ONLY_TOOLS, ...MUTATING_TOOLS] as const;

export type SupportedToolName = (typeof SUPPORTED_TOOL_NAMES)[number];

const SUPPORTED_TOOL_SET = new Set<string>(SUPPORTED_TOOL_NAMES);

function formatStringOutput(output: string): string {
  return stripConversationalFiller(output.trim());
}

function formatSearchCreatorsOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const search = output as { creators?: unknown[]; total?: number };
  const creators = normalizeCreators(search.creators);
  if (!creators.length) return "";
  return formatSearchResults(creators, search.total ?? creators.length);
}

function formatGenerateBriefOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const brief = output as {
    title?: string;
    sections?: Array<{ heading?: string; content?: string }>;
    content?: string;
    text?: string;
    brief?: string;
  };

  const legacy = (brief.content ?? brief.text ?? brief.brief ?? "").trim();
  if (legacy) return formatStringOutput(legacy);

  const parts: string[] = [];
  if (brief.title?.trim()) parts.push(`**${brief.title.trim()}**`);
  if (brief.sections?.length) {
    for (const section of brief.sections) {
      const heading = section.heading?.trim();
      const content = section.content?.trim();
      if (heading && content) parts.push(`### ${heading}\n${content}`);
      else if (content) parts.push(content);
      else if (heading) parts.push(`### ${heading}`);
    }
  }

  return parts.length ? formatStringOutput(parts.join("\n\n")) : "";
}

/** Always returns display text for buildCampaign — never falls through to generic handlers. */
export function formatBuildCampaignOutput(output: unknown): string {
  if (output == null) {
    return "Campaign draft (no details available)";
  }

  if (typeof output === "string") {
    const trimmed = output.trim();
    return trimmed ? formatStringOutput(trimmed) : "Campaign draft (no details available)";
  }

  if (typeof output !== "object") {
    return "Campaign draft (no details available)";
  }

  const obj = output as Record<string, unknown>;
  const nested = obj.draft;
  const source =
    nested && typeof nested === "object" ? (nested as Record<string, unknown>) : obj;

  const name = [source.name, source.title, obj.name, obj.title].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );

  const description = [source.description, obj.description].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );

  const summary = [source.summary, obj.summary].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );

  const lineItems = (source.suggestedLines ?? source.lines ?? obj.lines) as
    | Array<{ code?: string; name?: string; creatorId?: string; poAmount?: number }>
    | undefined;

  const lines: string[] = [];
  if (name) lines.push(`**${name.trim()}**`);
  if (description) lines.push(description.trim());
  if (summary) lines.push(summary.trim());

  if (Array.isArray(lineItems) && lineItems.length > 0) {
    lines.push(
      lineItems
        .map((line) => {
          const codePrefix = line.code ? `${line.code}: ` : "";
          const label =
            line.name?.trim() ??
            (line.creatorId ? `Creator ${line.creatorId}` : "Line");
          const po = line.poAmount != null ? ` (PO: ${line.poAmount})` : "";
          return `- ${codePrefix}${label}${po}`;
        })
        .join("\n")
    );
  }

  if (lines.length > 0) {
    return formatStringOutput(lines.join("\n\n"));
  }

  return "Campaign draft (details pending approval)";
}

function formatGenerateReportOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const report = output as {
    title?: string;
    summary?: string;
    content?: string;
    text?: string;
    metrics?: Array<{ label?: string; value?: string }>;
    recommendations?: string[];
  };

  const parts: string[] = [];
  if (report.title?.trim()) parts.push(`**${report.title.trim()}**`);

  const summary = (report.content ?? report.summary ?? report.text ?? "").trim();
  if (summary) parts.push(summary);

  if (report.metrics?.length) {
    parts.push(
      report.metrics
        .filter((metric) => metric.label && metric.value)
        .map((metric) => `- **${metric.label}**: ${metric.value}`)
        .join("\n")
    );
  }

  if (report.recommendations?.length) {
    parts.push(
      "**Recommendations**\n" +
        report.recommendations.map((item) => `- ${item}`).join("\n")
    );
  }

  return parts.length ? formatStringOutput(parts.join("\n\n")) : "";
}

function formatGetCampaignOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const campaign = output as { code?: string; name?: string; status?: string; poAmount?: number };
  const parts: string[] = [];
  if (campaign.name) parts.push(`**${campaign.name}**`);
  if (campaign.code) parts.push(`Code: ${campaign.code}`);
  if (campaign.status) parts.push(`Status: ${campaign.status}`);
  if (campaign.poAmount != null) parts.push(`PO: ${campaign.poAmount}`);
  return parts.length ? formatStringOutput(parts.join("\n")) : "";
}

function formatGetClientOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const client = output as { name?: string; country?: string; brandCount?: number };
  const parts: string[] = [];
  if (client.name) parts.push(`**${client.name}**`);
  if (client.country) parts.push(`Country: ${client.country}`);
  if (client.brandCount != null) parts.push(`Brands: ${client.brandCount}`);
  return parts.length ? formatStringOutput(parts.join("\n")) : "";
}

function formatGetCreatorOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const creator = output as {
    displayName?: string;
    handle?: string;
    platform?: string;
    followers?: number;
    engagementRate?: number;
  };
  const name = creator.displayName ?? creator.handle;
  if (!name) return "";
  const parts = [`**${name}**`];
  if (creator.platform) parts.push(`Platform: ${creator.platform}`);
  if (creator.followers != null) parts.push(`Followers: ${creator.followers.toLocaleString()}`);
  if (creator.engagementRate != null) parts.push(`Engagement: ${creator.engagementRate}%`);
  return formatStringOutput(parts.join("\n"));
}

function formatGetShortlistOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const shortlist = output as { name?: string; status?: string; creatorCount?: number };
  const parts: string[] = [];
  if (shortlist.name) parts.push(`**${shortlist.name}**`);
  if (shortlist.status) parts.push(`Status: ${shortlist.status}`);
  if (shortlist.creatorCount != null) parts.push(`Creators: ${shortlist.creatorCount}`);
  return parts.length ? formatStringOutput(parts.join("\n")) : "";
}

function formatCreateShortlistOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const shortlist = output as { name?: string; creatorCount?: number; status?: string };
  const parts: string[] = [];
  if (shortlist.name) parts.push(`**${shortlist.name}**`);
  if (shortlist.creatorCount != null) parts.push(`${shortlist.creatorCount} creator(s)`);
  if (shortlist.status) parts.push(`Status: ${shortlist.status}`);
  return parts.length ? formatStringOutput(parts.join(" — ")) : "";
}

/**
 * Format a single tool output for workflow summary display.
 * Exhaustive per supported tool — no recursive fallback.
 */
export function formatToolOutput(tool: string, output: unknown): string {
  if (typeof output === "string" && output.trim()) {
    return formatStringOutput(output);
  }

  switch (tool) {
    case "searchCreators":
      return formatSearchCreatorsOutput(output);
    case "generateBrief":
      return formatGenerateBriefOutput(output);
    case "buildCampaign":
      return formatBuildCampaignOutput(output);
    case "generateReport":
      return formatGenerateReportOutput(output);
    case "getCampaign":
      return formatGetCampaignOutput(output);
    case "getClient":
      return formatGetClientOutput(output);
    case "getCreator":
      return formatGetCreatorOutput(output);
    case "getShortlist":
      return formatGetShortlistOutput(output);
    case "createShortlist":
      return formatCreateShortlistOutput(output);
    default:
      return SUPPORTED_TOOL_SET.has(tool) ? "" : "Unsupported tool";
  }
}
