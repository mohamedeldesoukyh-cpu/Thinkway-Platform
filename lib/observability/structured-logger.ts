import { getRequestContext } from "@/lib/observability/request-context";
import { getThinkwayEnvironment, isStructuredLoggingEnabled } from "@/lib/observability/environment";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogFields = {
  service?: string;
  workflow?: string;
  requestId?: string;
  conversationId?: string;
  campaignId?: string;
  userId?: string;
  creatorId?: string;
  influencerId?: string;
  jobId?: string;
  outcome?: string;
  duration?: number;
  durationMs?: number;
  status?: string | number;
  error?: string;
  [key: string]: unknown;
};

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function shouldEmit(level: LogLevel): boolean {
  if (level === "debug") return isDev() || process.env.LOG_LEVEL === "debug";
  return true;
}

function buildPayload(
  level: LogLevel,
  scope: string,
  message: string,
  fields?: StructuredLogFields
): Record<string, unknown> {
  const ctx = getRequestContext();
  const duration =
    fields?.durationMs ?? fields?.duration ?? undefined;

  return {
    timestamp: new Date().toISOString(),
    level,
    service: fields?.service ?? ctx?.service ?? scope,
    message,
    environment: getThinkwayEnvironment(),
    requestId: fields?.requestId ?? ctx?.requestId,
    workflow: fields?.workflow ?? ctx?.workflow,
    conversationId: fields?.conversationId ?? ctx?.conversationId,
    campaignId: fields?.campaignId ?? ctx?.campaignId,
    userId: fields?.userId ?? ctx?.userId,
    creatorId: fields?.creatorId ?? ctx?.creatorId,
    influencerId: fields?.influencerId ?? ctx?.influencerId ?? fields?.creatorId ?? ctx?.creatorId,
    jobId: fields?.jobId ?? ctx?.jobId,
    outcome: fields?.outcome ?? ctx?.outcome,
    ...(duration != null ? { durationMs: duration } : {}),
    ...(fields?.status != null ? { status: fields.status } : {}),
    ...(fields?.error ? { error: fields.error } : {}),
    ...Object.fromEntries(
      Object.entries(fields ?? {}).filter(
        ([key]) =>
          ![
            "service",
            "workflow",
            "requestId",
            "conversationId",
            "campaignId",
            "userId",
            "creatorId",
            "influencerId",
            "jobId",
            "outcome",
            "duration",
            "durationMs",
            "status",
            "error",
          ].includes(key)
      )
    ),
  };
}

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  fields?: StructuredLogFields
): void {
  if (!shouldEmit(level)) return;

  const payload = buildPayload(level, scope, message, fields);

  if (isStructuredLoggingEnabled()) {
    const line = JSON.stringify(payload);
    switch (level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      default:
        console.log(line);
        break;
    }
    return;
  }

  const prefix = `[${scope}]`;
  const detail = fields && Object.keys(fields).length > 0 ? fields : undefined;
  switch (level) {
    case "error":
      console.error(prefix, message, detail ?? "");
      break;
    case "warn":
      console.warn(prefix, message, detail ?? "");
      break;
    case "info":
      console.info(prefix, message, detail ?? "");
      break;
    default:
      console.debug(prefix, message, detail ?? "");
      break;
  }
}

export function logDebug(
  scope: string,
  message: string,
  fields?: StructuredLogFields
): void {
  writeLog("debug", scope, message, fields);
}

export function logInfo(
  scope: string,
  message: string,
  fields?: StructuredLogFields
): void {
  writeLog("info", scope, message, fields);
}

export function logWarn(
  scope: string,
  message: string,
  fields?: StructuredLogFields
): void {
  writeLog("warn", scope, message, fields);
}

export function logError(
  scope: string,
  message: string,
  fields?: StructuredLogFields
): void {
  writeLog("error", scope, message, fields);
}

export function startTimer(): number {
  return performance.now();
}

export function logDuration(
  scope: string,
  message: string,
  startedAt: number,
  fields?: StructuredLogFields
): void {
  writeLog("info", scope, message, {
    ...fields,
    durationMs: Math.round(performance.now() - startedAt),
  });
}
