export const AUDIT_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  APPROVE: "approve",
  REJECT: "reject",
  SUBMIT: "submit",
  PUBLISH: "publish",
  VOID: "void",
  EXPORT: "export",
} as const;

import type { AuditAction } from "@/lib/domains/audit/types";

export type { AuditAction } from "@/lib/domains/audit/types";

const VALID_AUDIT_ACTIONS = new Set<string>(Object.values(AUDIT_ACTIONS));

const TRIGGER_OP_TO_AUDIT: Record<string, AuditAction> = {
  INSERT: AUDIT_ACTIONS.CREATE,
  UPDATE: AUDIT_ACTIONS.UPDATE,
  DELETE: AUDIT_ACTIONS.DELETE,
};

/** Normalizes audit action values before writing to audit_action enum columns. */
export function normalizeAuditAction(action: string): string {
  const trimmed = String(action).trim();
  const upper = trimmed.toUpperCase();

  if (upper in TRIGGER_OP_TO_AUDIT) {
    return TRIGGER_OP_TO_AUDIT[upper];
  }

  const lower = trimmed.toLowerCase();
  if (VALID_AUDIT_ACTIONS.has(lower)) {
    return lower;
  }

  return lower;
}

export function isAuditAction(value: string): value is AuditAction {
  return VALID_AUDIT_ACTIONS.has(normalizeAuditAction(value));
}
