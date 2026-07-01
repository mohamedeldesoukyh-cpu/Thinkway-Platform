import JSZip from "jszip";

import type { ImportParseDiagnostics, ParsedCreatorRow } from "../types";
import type { ParseResult } from "./index";

/** Same ceiling as creator-import uploads (see CREATOR_IMPORT_MAX_BYTES). */
export const ZIP_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const ZIP_MAX_ENTRIES = 500;
export const ZIP_MAX_DATA_FILES = 50;

const DATA_EXTENSIONS = new Set([".csv", ".xlsx"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const AVATAR_FOLDER_NAMES = new Set(["images", "avatars", "photos", "profile_pictures"]);

export type ZipExtractedEntry = {
  path: string;
  buffer: Buffer;
};

export function normalizeZipEntryPath(entryPath: string): string {
  return entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Reject path traversal and absolute paths inside ZIP archives. */
export function isSafeZipEntryPath(entryPath: string): boolean {
  const normalized = normalizeZipEntryPath(entryPath);
  if (!normalized || normalized.includes("\0")) return false;

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment === "..") return false;
    if (segment === "." && segments.length > 1) return false;
  }

  return true;
}

function getEntryBasename(entryPath: string): string {
  const normalized = normalizeZipEntryPath(entryPath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

function getEntryExtension(entryPath: string): string {
  const base = getEntryBasename(entryPath);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

function isAvatarImageEntry(entryPath: string): boolean {
  const normalized = normalizeZipEntryPath(entryPath);
  const ext = getEntryExtension(normalized);
  if (!IMAGE_EXTENSIONS.has(ext)) return false;

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 1) return true;

  const parentFolder = parts[parts.length - 2]?.toLowerCase();
  return parentFolder ? AVATAR_FOLDER_NAMES.has(parentFolder) : false;
}

function avatarUsernameFromEntry(entryPath: string): string | null {
  const base = getEntryBasename(entryPath);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  return base.slice(0, dot).trim().replace(/^@+/, "").toLowerCase();
}

function mergeParseResults(
  results: ParseResult[],
  avatarImageCount: number
): ParseResult {
  const rows: ParsedCreatorRow[] = [];
  const seen = new Set<string>();
  const parsers: string[] = [];
  let extractedTextLength = 0;

  for (const result of results) {
    parsers.push(result.parser);
    if (result.diagnostics.extractedTextLength != null) {
      extractedTextLength += result.diagnostics.extractedTextLength;
    }

    for (const row of result.rows) {
      const key = `${row.platform}:${row.username.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  const warnings: string[] = [];
  if (results.length === 0) {
    warnings.push("ZIP contained no CSV or XLSX files.");
  } else if (rows.length === 0) {
    warnings.push("No creator rows matched in ZIP data files.");
  }
  if (avatarImageCount > 0) {
    warnings.push(
      `${avatarImageCount} avatar image(s) found in ZIP; include profile photo URLs in CSV columns or refresh avatars from creator profiles later — local images are not uploaded automatically.`
    );
  }

  const diagnostics: ImportParseDiagnostics = {
    extractedTextLength: extractedTextLength || null,
    extractionMethod: "text",
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  };

  return {
    parser: parsers.length === 1 ? `zip:${parsers[0]}` : `zip:bundle(${parsers.length})`,
    rows,
    diagnostics,
  };
}

export async function extractZipEntries(buffer: Buffer): Promise<ZipExtractedEntry[]> {
  const zip = await JSZip.loadAsync(buffer);
  const entries: ZipExtractedEntry[] = [];
  let totalUncompressed = 0;

  const fileNames = Object.keys(zip.files);
  if (fileNames.length > ZIP_MAX_ENTRIES) {
    throw new Error(`ZIP contains too many entries (max ${ZIP_MAX_ENTRIES}).`);
  }

  for (const rawPath of fileNames) {
    const entry = zip.files[rawPath];
    if (!entry || entry.dir) continue;

    if (!isSafeZipEntryPath(rawPath)) {
      throw new Error(`Unsafe ZIP entry path rejected: ${rawPath}`);
    }

    const normalizedPath = normalizeZipEntryPath(rawPath);
    const content = await entry.async("nodebuffer");
    totalUncompressed += content.length;

    if (totalUncompressed > ZIP_MAX_UNCOMPRESSED_BYTES) {
      throw new Error("ZIP uncompressed content exceeds the 50 MB limit.");
    }

    entries.push({ path: normalizedPath, buffer: content });
  }

  return entries;
}

export async function parseZipBuffer(
  buffer: Buffer,
  source: string | null
): Promise<ParseResult> {
  const { parseCsvText, parseXlsxBuffer } = await import("./index");

  const entries = await extractZipEntries(buffer);
  const dataFiles = entries.filter((entry) =>
    DATA_EXTENSIONS.has(getEntryExtension(entry.path))
  );

  if (dataFiles.length > ZIP_MAX_DATA_FILES) {
    throw new Error(`ZIP contains too many data files (max ${ZIP_MAX_DATA_FILES}).`);
  }

  const avatarImageCount = entries.filter((entry) => isAvatarImageEntry(entry.path)).length;

  const parseResults: ParseResult[] = [];
  for (const entry of dataFiles) {
    const ext = getEntryExtension(entry.path);
    if (ext === ".csv") {
      parseResults.push(parseCsvText(entry.buffer.toString("utf8"), source));
    } else if (ext === ".xlsx") {
      parseResults.push(parseXlsxBuffer(entry.buffer, source));
    }
  }

  const merged = mergeParseResults(parseResults, avatarImageCount);

  // Match avatar filenames to usernames for diagnostics only (no local upload yet).
  if (avatarImageCount > 0 && merged.rows.length > 0) {
    const avatarUsernames = new Set<string>();
    for (const entry of entries) {
      if (!isAvatarImageEntry(entry.path)) continue;
      const username = avatarUsernameFromEntry(entry.path);
      if (username) avatarUsernames.add(username);
    }

    const matched = merged.rows.filter((row) =>
      avatarUsernames.has(row.username.toLowerCase())
    ).length;

    if (matched > 0 && merged.diagnostics.warning) {
      merged.diagnostics.warning += ` ${matched} creator row(s) have matching avatar filenames in the ZIP.`;
    }
  }

  return merged;
}
