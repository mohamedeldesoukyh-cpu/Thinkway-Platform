import type { BusinessFunction } from "@/types/database";

export type SettingsUserStatus = "invited" | "active" | "disabled";
export type SettingsPortalType = "internal" | "client" | "creator";

export type SettingsUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  role_slug: string | null;
  business_function: BusinessFunction | null;
  department: string | null;
  country: string | null;
  status: SettingsUserStatus;
  last_login: string | null;
  portal_type: SettingsPortalType;
  access_level: string | null;
  is_active: boolean;
};

export type SettingsRoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  user_count: number;
  permission_count: number;
};

export type SettingsPermissionRow = {
  id: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
};

export type RolePermissionMatrix = {
  role_id: string;
  role_slug: string;
  role_name: string;
  permissions: string[];
};

export type AccessControlModule = {
  key: string;
  label: string;
  permissions: string[];
};

export type UserInviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  role_id: string | null;
  portal_type: SettingsPortalType;
  status: string;
  expires_at: string;
  created_at: string;
};
