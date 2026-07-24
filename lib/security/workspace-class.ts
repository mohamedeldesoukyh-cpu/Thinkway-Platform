/**
 * P4 Workspace classification taxonomy.
 * Every HTTP surface must resolve to exactly one class.
 */
export const WORKSPACE_CLASSES = [
  "public",
  "authenticated",
  "client_workspace",
  "internal_workspace",
  "admin_only",
  "service_only",
] as const;

export type WorkspaceClass = (typeof WORKSPACE_CLASSES)[number];

export type WorkspaceSurfaceKind =
  | "page"
  | "api"
  | "action"
  | "worker"
  | "cron";

export type WorkspaceClassificationEntry = {
  /** Stable id: route path pattern, action module, or worker name */
  id: string;
  kind: WorkspaceSurfaceKind;
  class: WorkspaceClass;
  /** Optional portal flavor when class is client_workspace */
  portal?: "client" | "creator";
  notes?: string;
};

export function isWorkspaceClass(value: string): value is WorkspaceClass {
  return (WORKSPACE_CLASSES as readonly string[]).includes(value);
}
