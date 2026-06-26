export const INDEPENDENT_GROUP_DISPLAY_NAME = "Independent";

export function formatGroupDisplayName(
  name: string | null | undefined
): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : INDEPENDENT_GROUP_DISPLAY_NAME;
}
