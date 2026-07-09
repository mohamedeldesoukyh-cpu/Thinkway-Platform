import { formatDiscoveryMappedFilterValue } from "../services/discovery-search-mapping/map-campaign-intelligence";
import type { DiscoveryMappedFilter, DiscoverySearchMappingResult } from "../services/discovery-search-mapping/types";
import type { ExtractionIssue } from "../services/normalization/types";
import type { EvidenceReviewRow } from "../services/normalization/validate-normalized-evidence";
import type {
  StructuredBriefBlock,
  StructuredBriefDocument,
  StructuredBriefParserMode,
} from "../services/structured-brief-parser/types";
import type { CampaignIntelligencePipelineDebug } from "../types/pipeline-debug";
import type { CampaignIntelligenceProfile } from "../types/profile";
import type { ValidatedCampaignIntelligence } from "../types/validated-intelligence";

export const PARSER_MODE_LABELS: Record<
  StructuredBriefParserMode,
  { label: string; category: "structured" | "fallback"; description: string }
> = {
  docx_ooxml_tables: {
    label: "Structured (OOXML tables)",
    category: "structured",
    description: "Parsed word/document.xml and detected w:tbl table rows without cell merging.",
  },
  docx_mammoth_html: {
    label: "Fallback (Mammoth HTML)",
    category: "fallback",
    description: "No OOXML tables found; used mammoth.convertToHtml for structure.",
  },
  docx_mammoth_raw_repair: {
    label: "Fallback (Mammoth plain text + repair)",
    category: "fallback",
    description:
      "No OOXML tables; mammoth raw text with repairFlattenedKeyValue — may concatenate fields.",
  },
  docx_ooxml_empty: {
    label: "Fallback (OOXML empty)",
    category: "fallback",
    description: "OOXML parse returned no usable blocks.",
  },
  pdf_text: {
    label: "PDF text extraction",
    category: "fallback",
    description: "Plain text from PDF, structured via line heuristics.",
  },
  pptx_xml: {
    label: "PPTX slide XML",
    category: "structured",
    description: "Extracted slide text from ppt/slides/*.xml.",
  },
  plain_text: {
    label: "Plain text",
    category: "fallback",
    description: "Line-based structure from plain text / RTF / legacy DOC.",
  },
};

export function inferParserMode(document?: StructuredBriefDocument): StructuredBriefParserMode | undefined {
  if (!document) return undefined;
  if (document.parserMode) return document.parserMode;

  const allText = document.sections
    .flatMap((s) => s.blocks)
    .map((b) => blockText(b))
    .join("\n");

  if (/ParisMarket|EgyptCampaign|Name\s*:\s*L'Oréal ParisMarket/i.test(allText)) {
    return "docx_mammoth_raw_repair";
  }

  const hasOoxmlTables = document.sections.some((s) =>
    s.blocks.some((b) => b.type === "table" && b.rows.some((r) => r.length >= 2 && !r[1]?.includes("Market :")))
  );
  if (hasOoxmlTables) return "docx_ooxml_tables";

  if (document.sourceFormat === "pdf") return "pdf_text";
  if (document.sourceFormat === "pptx") return "pptx_xml";
  return "plain_text";
}

function blockText(block: StructuredBriefBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return block.text;
    case "list":
      return block.items.join("\n");
    case "table":
      return block.rows.map((r) => r.join(" | ")).join("\n");
    default:
      return "";
  }
}

export function resolveParserModeInfo(document?: StructuredBriefDocument) {
  const mode = inferParserMode(document);
  if (!mode) {
    return {
      mode: undefined,
      label: "Unknown",
      category: "fallback" as const,
      description: "Parser mode was not captured for this run. Re-upload to record it.",
    };
  }
  const info = PARSER_MODE_LABELS[mode];
  return { mode, ...info };
}

export function parseRawLlmJson(raw: string | null): { parsed: unknown | null; error?: string } {
  if (!raw?.trim()) return { parsed: null };
  try {
    return { parsed: JSON.parse(raw) as unknown };
  } catch (error) {
    return {
      parsed: null,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export type ParsedSkippedFilter = {
  raw: string;
  field: string;
  value: string;
  reason: string;
};

export function parseDiscoverySkippedEntry(entry: string): ParsedSkippedFilter {
  const colon = entry.indexOf(":");
  if (colon === -1) {
    return {
      raw: entry,
      field: entry,
      value: "",
      reason: entry === "no_validated_intelligence" ? "No validated intelligence SSOT on profile." : entry,
    };
  }
  const field = entry.slice(0, colon);
  const value = entry.slice(colon + 1);
  return {
    raw: entry,
    field,
    value,
    reason: `Skipped during Discovery mapping (${field}).`,
  };
}

export type DiscoveryNotGeneratedRow = {
  field: string;
  sourceValue: string;
  reason: string;
};

export function computeDiscoveryNotGenerated(
  validated: ValidatedCampaignIntelligence | undefined,
  extracted: CampaignIntelligenceProfile | undefined,
  mapping?: DiscoverySearchMappingResult
): DiscoveryNotGeneratedRow[] {
  if (!validated) return [];

  const filterValues = new Set(
    (mapping?.filters ?? []).map((f) => `${f.key}:${f.value.toLowerCase()}`)
  );
  const rows: DiscoveryNotGeneratedRow[] = [];

  const check = (field: string, hasValue: boolean, sourceValue: string, filterKey: string, filterValue: string, reason: string) => {
    if (!hasValue) return;
    const key = `${filterKey}:${filterValue.toLowerCase()}`;
    if (!filterValues.has(key)) {
      rows.push({ field, sourceValue, reason });
    }
  };

  for (const code of validated.audience.countries) {
    check(
      "Audience country",
      Boolean(code),
      code,
      "audience_country",
      code,
      "Country present in validated intelligence but no audience_country filter was emitted."
    );
  }

  if (validated.market.countryCode) {
    check(
      "Market country",
      true,
      validated.market.countryCode,
      "creator_country",
      validated.market.countryCode,
      "Market country did not produce a creator_country filter."
    );
  }

  for (const category of validated.categories) {
    check(
      "Category",
      Boolean(category),
      category,
      "category",
      category,
      "Category in validated intelligence but no category filter was emitted."
    );
  }

  for (const niche of validated.creator.niches) {
    check(
      "Niche",
      Boolean(niche),
      niche,
      "niche",
      niche,
      "Niche in validated intelligence but no niche filter was emitted."
    );
  }

  for (const keyword of validated.keywords) {
    check(
      "Keyword",
      Boolean(keyword),
      keyword,
      "content_keyword",
      keyword,
      "Keyword in validated intelligence but no content_keyword filter was emitted."
    );
  }

  if (validated.audience.gender && validated.audience.gender !== "any") {
    check(
      "Audience gender",
      true,
      validated.audience.gender,
      "audience_gender",
      validated.audience.gender,
      "Gender in validated intelligence but no audience_gender filter was emitted."
    );
  }

  if (validated.creator.followerMin != null) {
    check(
      "Follower min",
      true,
      String(validated.creator.followerMin),
      "follower_min",
      String(validated.creator.followerMin),
      "Follower min in validated intelligence but no follower_min filter was emitted."
    );
  }

  if (extracted?.creatorCategories?.length && validated.categories.length === 0) {
    rows.push({
      field: "Creator categories",
      sourceValue: extracted.creatorCategories.join(", "),
      reason: "Extracted but cleared or rejected before validated intelligence — no category filters possible.",
    });
  }

  if (extracted?.creatorNiches?.length && validated.creator.niches.length === 0) {
    rows.push({
      field: "Creator niches",
      sourceValue: extracted.creatorNiches.join(", "),
      reason: "Extracted but not present in validated intelligence — no niche filters possible.",
    });
  }

  const extractedKeywords = [
    ...(extracted?.creatorNiches ?? []),
    ...(extracted?.products ?? []),
  ].filter(Boolean);
  if (extractedKeywords.length > 0 && validated.keywords.length === 0) {
    rows.push({
      field: "Keywords",
      sourceValue: extractedKeywords.slice(0, 5).join(", "),
      reason: "Content keywords were not carried into validated intelligence.",
    });
  }

  if (
    extracted?.brandName &&
    /ParisMarket|Market\s*:/i.test(extracted.brandName) &&
    !validated.brand.brandName
  ) {
    rows.push({
      field: "Brand",
      sourceValue: extracted.brandName,
      reason: "Brand value appears concatenated with adjacent fields from parser fallback.",
    });
  }

  return rows;
}

export function buildPipelineSummary(debug: CampaignIntelligencePipelineDebug) {
  const parserInfo = resolveParserModeInfo(debug.structuredParserOutput);
  const accepted = debug.validation.accepted.length;
  const rejected = debug.validation.rejected.length;
  const filters = debug.discoveryMapping?.filters.length ?? 0;
  const skipped = debug.discoveryMapping?.skipped.length ?? 0;

  return {
    parserInfo,
    extractionMode: debug.extractionMode ?? (debug.heuristicFallback ? "heuristic" : "llm"),
    extractionModeReason:
      debug.extractionModeReason ??
      (debug.heuristicFallback ? "Heuristic fallback" : "LLM extraction"),
    accepted,
    rejected,
    filters,
    skipped,
  };
}

export function formatFilterRow(filter: DiscoveryMappedFilter): string {
  return `${filter.label}: ${formatDiscoveryMappedFilterValue(filter)} (${filter.key}, confidence ${Math.round(filter.confidence * 100)}%)`;
}

export function severityClass(severity: ExtractionIssue["severity"]): string {
  return severity === "error"
    ? "text-destructive"
    : "text-amber-700 dark:text-amber-400";
}

export function evidenceLevelLabel(row: EvidenceReviewRow): string {
  const level = row.provenance?.level ?? "normalized";
  const confidence = row.provenance?.confidence;
  if (confidence != null) {
    return `${level} · ${Math.round(confidence * 100)}%`;
  }
  return level;
}
