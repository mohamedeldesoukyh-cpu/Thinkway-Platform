/**
 * Field envelope factory and path utilities for Creator DNA.
 */

import type {
  DnaFieldCandidate,
  DnaSource,
  FieldEnvelope,
  FieldHistoryEntry,
} from "../types";

export function createEmptyEnvelope<T>(defaultValue: T): FieldEnvelope<T> {
  return {
    value: defaultValue,
    confidence: 0,
    source: "ai_infer",
    sourceVersion: null,
    updatedAt: new Date(0).toISOString(),
    history: [],
  };
}

export function wrapValue<T>(
  value: T,
  source: DnaSource,
  confidence: number,
  options?: {
    sourceVersion?: string | number | null;
    updatedAt?: string;
    snapshotId?: string | null;
  }
): FieldEnvelope<T> {
  const updatedAt = options?.updatedAt ?? new Date().toISOString();
  const entry: FieldHistoryEntry<T> = {
    value,
    confidence,
    source,
    sourceVersion: options?.sourceVersion ?? null,
    updatedAt,
    snapshotId: options?.snapshotId ?? null,
  };
  return {
    value,
    confidence,
    source,
    sourceVersion: options?.sourceVersion ?? null,
    updatedAt,
    history: [entry],
  };
}

export function applyEnvelopeUpdate<T>(
  current: FieldEnvelope<T> | undefined,
  candidate: DnaFieldCandidate<T>,
  winner: FieldEnvelope<T>
): FieldEnvelope<T> {
  const prevHistory = current?.history ?? [];
  const newEntry: FieldHistoryEntry<T> = {
    value: candidate.value,
    confidence: candidate.confidence,
    source: candidate.source,
    sourceVersion: candidate.sourceVersion ?? null,
    updatedAt: candidate.updatedAt,
    snapshotId: candidate.snapshotId ?? null,
  };

  const history = [...prevHistory, newEntry].slice(-50);

  return {
    ...winner,
    history,
  };
}

export function getNestedEnvelope(
  document: Record<string, unknown>,
  path: string
): FieldEnvelope<unknown> | undefined {
  const parts = path.split(".");
  let cursor: unknown = document;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (cursor == null || typeof cursor !== "object") return undefined;
  const env = cursor as FieldEnvelope<unknown>;
  if (!("value" in env) || !("confidence" in env) || !("source" in env)) {
    return undefined;
  }
  return env;
}

export function setNestedEnvelope(
  document: Record<string, unknown>,
  path: string,
  envelope: FieldEnvelope<unknown>
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = document;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cursor[part] == null || typeof cursor[part] !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = envelope;
}

export function envelopeHasValue<T>(envelope: FieldEnvelope<T> | undefined): boolean {
  if (!envelope) return false;
  const v = envelope.value;
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}
