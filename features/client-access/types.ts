export type ClientAccessRole = "view" | "approve";

export type ClientAccessUserRow = {
  profile_id: string;
  full_name: string | null;
  email: string;
  access_role: ClientAccessRole;
  is_primary: boolean;
  granted_at: string;
};

export type ClientAccessEntityRow = {
  client_id: string;
  client_name: string;
  document_number: string;
  users: ClientAccessUserRow[];
};

export type AssignableClientProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
};
