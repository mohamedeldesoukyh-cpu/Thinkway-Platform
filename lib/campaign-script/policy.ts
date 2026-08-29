import type {
  CampaignScriptMasterView,
  ScriptActorKind,
  ScriptLanguage,
  ScriptTextOrigin,
} from "./types";
import { CAMPAIGN_SCRIPT_BODY_MAX_CHARS } from "./types";

export const SCRIPT_CAS_CONFLICT_MESSAGE =
  "A newer version of this script was saved. Load the latest version, or keep your draft and save it as the new current version.";

export function nextRevisionNumber(current: number | null | undefined): number {
  return Math.max(0, current ?? 0) + 1;
}

export function nextBusinessVersion(current: string | null | undefined): string {
  const trimmed = current?.trim();
  if (!trimmed) return "v1";
  const match = /^v(\d+)(?:\.(\d+))?$/i.exec(trimmed);
  if (!match) return "v1.1";
  const major = Number(match[1]);
  const minor = Number(match[2] ?? "0");
  if (Number.isNaN(major) || Number.isNaN(minor)) return "v1.1";
  return `v${major}.${minor + 1}`;
}

/** User saves bump v1 → v1.1. Translation-only revisions keep the same business version. */
export function businessVersionForSave(
  previous: string | null | undefined,
  bump: boolean
): string {
  if (!bump) return previous?.trim() || "v1";
  return nextBusinessVersion(previous);
}

export function decideCasWrite(
  expectedCurrentRevisionId: string | null,
  actualCurrentRevisionId: string | null
): "proceed" | "conflict" {
  if (expectedCurrentRevisionId === actualCurrentRevisionId) return "proceed";
  return "conflict";
}

export function normalizeScriptBody(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n/g, "\n");
}

export function validateScriptBodies(
  bodyEn: string,
  bodyAr: string
): { ok: true; bodyEn: string; bodyAr: string } | { ok: false; message: string } {
  const nextEn = normalizeScriptBody(bodyEn).trimEnd();
  const nextAr = normalizeScriptBody(bodyAr).trimEnd();
  if (!nextEn.trim() && !nextAr.trim()) {
    return { ok: false, message: "Add the English or Arabic script before saving." };
  }
  if (nextEn.length > CAMPAIGN_SCRIPT_BODY_MAX_CHARS || nextAr.length > CAMPAIGN_SCRIPT_BODY_MAX_CHARS) {
    return {
      ok: false,
      message: `Each language must be at most ${CAMPAIGN_SCRIPT_BODY_MAX_CHARS.toLocaleString("en")} characters.`,
    };
  }
  return { ok: true, bodyEn: nextEn, bodyAr: nextAr };
}

export function resolveScriptOrigins(input: {
  sourceLanguage: ScriptLanguage;
  bodyEn: string;
  bodyAr: string;
  previous?: Pick<
    CampaignScriptMasterView,
    "sourceLanguage" | "bodyEn" | "bodyAr" | "enOrigin" | "arOrigin"
  > | null;
}): { enOrigin: ScriptTextOrigin; arOrigin: ScriptTextOrigin } {
  return {
    enOrigin: originForLanguage({
      language: "en",
      sourceLanguage: input.sourceLanguage,
      body: input.bodyEn,
      previousBody: input.previous?.bodyEn ?? "",
      previousOrigin: input.previous?.enOrigin ?? null,
    }),
    arOrigin: originForLanguage({
      language: "ar",
      sourceLanguage: input.sourceLanguage,
      body: input.bodyAr,
      previousBody: input.previous?.bodyAr ?? "",
      previousOrigin: input.previous?.arOrigin ?? null,
    }),
  };
}

function originForLanguage(input: {
  language: ScriptLanguage;
  sourceLanguage: ScriptLanguage;
  body: string;
  previousBody: string;
  previousOrigin: ScriptTextOrigin | null;
}): ScriptTextOrigin {
  if (input.language === input.sourceLanguage) return "source";
  if (!input.body.trim()) return "generated";
  if (input.previousOrigin === "generated" && input.body === input.previousBody) {
    return "generated";
  }
  return "human_edited";
}

export function scriptLanguageLabel(language: ScriptLanguage): string {
  return language === "ar" ? "Arabic" : "English";
}

export function scriptOriginBadge(input: {
  language: ScriptLanguage;
  sourceLanguage: ScriptLanguage;
  origin: ScriptTextOrigin;
  body: string;
  translationStatus?: "idle" | "pending" | "generated" | "failed";
  stale?: boolean;
}): string {
  const name = scriptLanguageLabel(input.language);
  if (input.language === input.sourceLanguage) return `Original (${name})`;
  if (input.translationStatus === "pending") return `Translation (${name}) · pending`;
  if (input.translationStatus === "failed") return `Translation (${name}) · failed`;
  if (!input.body.trim()) return `Translation (${name}) · pending`;
  if (input.origin === "generated") return `Translation (${name}) · generated`;
  if (input.stale) return `Translation (${name}) · edited · out of sync`;
  return `Translation (${name}) · edited`;
}

export function formatScriptTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatScriptCurrentLabel(
  script: Pick<
    CampaignScriptMasterView,
    "businessVersion" | "actorKind" | "actorLabel" | "createdAt"
  >
): string {
  const actor =
    script.actorKind === "client"
      ? script.actorLabel?.trim() || "Client"
      : script.actorLabel?.trim() || "Thinkway";
  return `Current · ${script.businessVersion} · ${actor} · ${formatScriptTimestamp(script.createdAt)}`;
}

export function scriptConflictActorLabel(
  actorKind: ScriptActorKind | null | undefined,
  actorLabel: string | null | undefined
): string {
  if (actorKind === "client") return actorLabel?.trim() || "the client";
  return actorLabel?.trim() || "Thinkway";
}
