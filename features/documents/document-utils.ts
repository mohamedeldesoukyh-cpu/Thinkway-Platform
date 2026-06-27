import { format } from "date-fns";

import { labelForOption } from "@/features/clients/constants";
import {
  CLIENT_DOCUMENT_TYPE_OPTIONS,
} from "@/features/clients/constants";
import { GROUP_DOCUMENT_TYPE_OPTIONS } from "@/features/groups/types";
import { INFLUENCER_DOCUMENT_TYPE_OPTIONS } from "@/features/vendors/constants";
import type {
  DocumentEntityKind,
  DocumentTypeOption,
  DocumentWorkspaceConfig,
  EntityDocumentRow,
} from "@/features/documents/document-types";
import {
  CLIENT_DOCUMENTS_FILTER_ACCESSORS,
  GROUP_DOCUMENTS_FILTER_ACCESSORS,
  VENDOR_DOCUMENTS_FILTER_ACCESSORS,
} from "@/lib/tables/workspace-table-filter-fields";
import type { EntityDocumentUploadResult } from "@/lib/domains/document/types";

export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return format(new Date(value), "MMM d, yyyy");
}

export function resolveDocumentTypeLabel(
  documentType: string,
  options: readonly DocumentTypeOption[]
): string {
  return labelForOption(options, documentType);
}

export function getDocumentTypeOptions(
  entityKind: DocumentEntityKind
): readonly DocumentTypeOption[] {
  switch (entityKind) {
    case "client":
      return CLIENT_DOCUMENT_TYPE_OPTIONS;
    case "vendor":
      return INFLUENCER_DOCUMENT_TYPE_OPTIONS;
    case "group":
      return GROUP_DOCUMENT_TYPE_OPTIONS;
  }
}

export function getDocumentFilterAccessors(entityKind: DocumentEntityKind) {
  switch (entityKind) {
    case "client":
      return CLIENT_DOCUMENTS_FILTER_ACCESSORS;
    case "vendor":
      return VENDOR_DOCUMENTS_FILTER_ACCESSORS;
    case "group":
      return GROUP_DOCUMENTS_FILTER_ACCESSORS;
  }
}

/** Map generic upload form fields to entity-specific server action / API payloads. */
export function mapEntityDocumentUploadFormData(
  config: Pick<DocumentWorkspaceConfig, "entityIdField" | "entityKind">,
  entityId: string,
  formData: FormData
): FormData {
  const mapped = new FormData();
  mapped.set(config.entityIdField, entityId);
  mapped.set("document_type", String(formData.get("document_type") ?? ""));
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return mapped;
}

export function createEntityUploadHandler(
  config: Pick<
    DocumentWorkspaceConfig,
    "entityIdField" | "entityKind" | "uploadAction" | "uploadViaApi"
  >
) {
  if (config.uploadViaApi) {
    return async (entityId: string, formData: FormData) =>
      config.uploadViaApi!(
        entityId,
        mapEntityDocumentUploadFormData(config, entityId, formData)
      );
  }

  if (!config.uploadAction) {
    return undefined;
  }

  return async (
    _entityId: string,
    formData: FormData
  ): Promise<EntityDocumentUploadResult> => {
    const entityId = String(formData.get("entity_id") ?? "");
    const mapped = mapEntityDocumentUploadFormData(config, entityId, formData);
    return config.uploadAction!({ ok: false }, mapped);
  };
}

export function isDocumentExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiry = new Date(expiresAt);
  expiry.setHours(23, 59, 59, 999);
  return expiry.getTime() < Date.now();
}

export function isDocumentExpiringSoon(
  expiresAt: string | null,
  withinDays = 30
): boolean {
  if (!expiresAt || isDocumentExpired(expiresAt)) {
    return false;
  }
  const expiry = new Date(expiresAt);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + withinDays);
  return expiry.getTime() <= threshold.getTime();
}

export function documentExpiryStatus(
  expiresAt: string | null
): "none" | "valid" | "expiring" | "expired" {
  if (!expiresAt) {
    return "none";
  }
  if (isDocumentExpired(expiresAt)) {
    return "expired";
  }
  if (isDocumentExpiringSoon(expiresAt)) {
    return "expiring";
  }
  return "valid";
}

export function isPreviewableMimeType(mimeType: string | null): boolean {
  if (!mimeType) {
    return false;
  }
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  );
}

export function sortDocumentsByCreatedAt<T extends EntityDocumentRow>(
  documents: T[]
): T[] {
  return [...documents].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
