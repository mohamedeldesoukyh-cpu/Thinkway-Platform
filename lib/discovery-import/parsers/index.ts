import type { ParsedCreatorRow } from "../types";
import {
  isIndahashText,
  normalizeImportPlatform,
  parseIndahashCsvRow,
  parseIndahashSearchExport,
  parseIndahashText,
} from "./indahash";
import { extractPdfText } from "./pdf-text";
import { parseZipBuffer } from "./zip";
import type { ImportParseDiagnostics } from "../types";
import { lookupCell, buildNormalizedRowLookup } from "@/lib/intelligence/parsers/header-normalize";
import { parseCompactCount } from "@/lib/social/parse-compact-count";

function splitTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePercent(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.trim().replace(/%/g, "");
  const num = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function parseImportProfilePictureUrlRaw(lookup: Map<string, unknown>): string | null {
  return lookupCell(
    lookup,
    "avatar url",
    "avatar_url",
    "profile photo",
    "profile_photo",
    "profile picture url",
    "profile_picture_url",
    "profile picture",
    "profile_picture",
    "profile pic",
    "profile_pic",
    "profile image url",
    "profile_image_url",
    "profile image",
    "profile_image",
    "image url",
    "image_url",
    "photo",
    "picture",
    "avatar",
    "thumbnail",
    "headshot"
  );
}

function parseImportRoleRaw(lookup: Map<string, unknown>): string | null {
  return lookupCell(
    lookup,
    "role",
    "creator role",
    "creator_role",
    "type",
    "creator type",
    "creator_type",
    "details",
    "creator details",
    "creator_details"
  );
}

function parseGenericTabularRow(
  row: Record<string, unknown>,
  source: string | null
): ParsedCreatorRow | null {
  const lookup = buildNormalizedRowLookup(row);

  const usernameRaw =
    lookupCell(lookup, "username", "handle", "creator", "social handle") ?? "";
  const username = usernameRaw.replace(/^@+/, "").trim();
  if (!username) return null;

  const platform = normalizeImportPlatform(
    lookupCell(lookup, "platform", "social network", "network", "channel")
  );
  if (!platform) return null;

  const followers = parseCompactCount(
    lookupCell(lookup, "followers", "follower count", "follower number", "fans")
  );
  const engagement_rate = parsePercent(
    lookupCell(lookup, "engagement rate", "engagement_rate", "er%", "avg er%")
  );
  const country = lookupCell(lookup, "country", "location", "geo", "market");
  const categories = splitTags(
    lookupCell(lookup, "categories", "category", "niche")
  );
  const audience_interests = splitTags(
    lookupCell(lookup, "audience interests", "interests", "tags")
  );
  const relevance_score = parsePercent(
    lookupCell(lookup, "relevance score", "relevance", "score")
  );

  return {
    username,
    platform,
    followers,
    engagement_rate,
    country,
    source,
    categories: categories.length > 0 ? categories : audience_interests,
    audience_interests:
      audience_interests.length > 0 ? audience_interests : categories,
    relevance_score,
    profile_picture_url: parseImportProfilePictureUrlRaw(lookup),
    role: parseImportRoleRaw(lookup),
  };
}

export type ParseResult = {
  parser: string;
  rows: ParsedCreatorRow[];
  diagnostics: ImportParseDiagnostics;
};

export function parseCsvText(
  text: string,
  source: string | null
): ParseResult {
  const diagnostics: ImportParseDiagnostics = {
    extractedTextLength: text.length,
    extractionMethod: "text",
    warning: null,
  };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      parser: "csv-empty",
      rows: [],
      diagnostics: { ...diagnostics, warning: "CSV had fewer than 2 rows." },
    };
  }

  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(";")
      ? ";"
      : ",";

  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const rows: ParsedCreatorRow[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(1)) {
    const values = line.split(delimiter);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });

    const row =
      parseIndahashCsvRow(record, source) ?? parseGenericTabularRow(record, source);
    if (!row) continue;

    const key = `${row.platform}:${row.username.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return {
    parser: isIndahashText(lines.join("\n")) ? "indahash-csv" : "generic-csv",
    rows,
    diagnostics: {
      ...diagnostics,
      warning: rows.length === 0 ? "No creator rows matched in CSV." : null,
    },
  };
}

export function parseXlsxBuffer(
  buffer: Buffer,
  source: string | null
): ParseResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      parser: "xlsx-empty",
      rows: [],
      diagnostics: {
        extractedTextLength: 0,
        extractionMethod: "text",
        warning: "Workbook had no sheets.",
      },
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows: ParsedCreatorRow[] = [];
  const seen = new Set<string>();

  for (const record of jsonRows) {
    const row =
      parseIndahashCsvRow(
        Object.fromEntries(
          Object.entries(record).map(([key, value]) => [key, String(value ?? "")])
        ),
        source
      ) ?? parseGenericTabularRow(record, source);

    if (!row) continue;
    const key = `${row.platform}:${row.username.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  const headerText = jsonRows.length
    ? JSON.stringify(Object.keys(jsonRows[0] ?? {}))
    : "";

  return {
    parser: isIndahashText(headerText) ? "indahash-xlsx" : "generic-xlsx",
    rows,
    diagnostics: {
      extractedTextLength: headerText.length,
      extractionMethod: "text",
      warning: rows.length === 0 ? "No creator rows matched in workbook." : null,
    },
  };
}

export async function parsePdfBuffer(
  buffer: Buffer,
  source: string | null
): Promise<ParseResult> {
  const text = await extractPdfText(buffer);
  const textLength = text.length;
  console.log("[creator-import] extracted text length", textLength);

  const baseDiagnostics: ImportParseDiagnostics = {
    extractedTextLength: textLength,
    extractionMethod: "text",
    warning: null,
  };

  // Genuinely empty extraction → likely a scanned/image-only PDF needing OCR.
  if (textLength < 100) {
    console.log("[creator-import] first 3000 chars", text.slice(0, 3000));
    return {
      parser: "pdf-empty-text",
      rows: [],
      diagnostics: {
        ...baseDiagnostics,
        warning: `PDF text extraction returned ${textLength} chars — file may be a scanned/image PDF requiring OCR.`,
      },
    };
  }

  // Strategy 1: structured "@handle Platform followers ER% ..." layout.
  const structuredRows = parseIndahashText(text, source);
  if (structuredRows.length > 0) {
    console.log(`[creator-import] extracted creators=${structuredRows.length} (structured)`);
    return {
      parser: isIndahashText(text) ? "indahash-pdf" : "indahash-pdf-heuristic",
      rows: structuredRows,
      diagnostics: baseDiagnostics,
    };
  }

  // Strategy 2: indaHash web "Creator Search" flattened table export.
  const searchRows = parseIndahashSearchExport(text, source);
  if (searchRows.length > 0) {
    console.log(`[creator-import] extracted creators=${searchRows.length} (search-export)`);
    return {
      parser: "indahash-pdf-search",
      rows: searchRows,
      diagnostics: baseDiagnostics,
    };
  }

  console.log("[creator-import] extracted creators=0");
  console.log("[creator-import] first 3000 chars", text.slice(0, 3000));
  return {
    parser: "pdf-unrecognized",
    rows: [],
    diagnostics: {
      ...baseDiagnostics,
      warning: `PDF text extracted (${textLength} chars) but no creators matched any known indaHash layout.`,
    },
  };
}

export async function parseImportFile(params: {
  fileType: string;
  buffer: Buffer;
  sourceName: string | null;
}): Promise<ParseResult> {
  const source = params.sourceName?.trim() || null;

  switch (params.fileType) {
    case "csv":
      return parseCsvText(params.buffer.toString("utf8"), source);
    case "xlsx":
      return parseXlsxBuffer(params.buffer, source);
    case "pdf":
      return parsePdfBuffer(params.buffer, source);
    case "zip":
      return parseZipBuffer(params.buffer, source);
    default:
      return {
        parser: "unsupported",
        rows: [],
        diagnostics: {
          extractedTextLength: null,
          extractionMethod: null,
          warning: `Unsupported file type: ${params.fileType}`,
        },
      };
  }
}
