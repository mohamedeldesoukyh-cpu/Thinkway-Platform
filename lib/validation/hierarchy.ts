export function normalizeEntityName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export const DUPLICATE_MESSAGES = {
  group: "A group with this name already exists.",
  client: "This legal entity already exists under the same relationship type.",
  brand: "This brand already exists under this legal entity.",
} as const;

export type DuplicateEntity = keyof typeof DUPLICATE_MESSAGES;

export function mapUniqueViolationMessage(
  error: { code?: string; message?: string },
  entity: DuplicateEntity
): string | null {
  if (error.code === "23505") {
    return DUPLICATE_MESSAGES[entity];
  }
  const msg = error.message?.toLowerCase() ?? "";
  if (msg.includes("groups_name_normalized_unique")) {
    return DUPLICATE_MESSAGES.group;
  }
  if (msg.includes("clients_name_relationship_unique")) {
    return DUPLICATE_MESSAGES.client;
  }
  if (msg.includes("brands_client_name_normalized_unique")) {
    return DUPLICATE_MESSAGES.brand;
  }
  return null;
}

export function friendlyActionError(
  error: { code?: string; message?: string },
  entity: DuplicateEntity,
  fallback = "Something went wrong. Please try again."
): string {
  return mapUniqueViolationMessage(error, entity) ?? fallback;
}
