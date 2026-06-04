export const CLIENT_ACCESS_REVALIDATE_PATHS = [
  "/settings/client-access",
  "/clients",
] as const;

export const CLIENT_ACCESS_ROLES = [
  { value: "view", label: "View" },
  { value: "approve", label: "Approve" },
] as const;
