/** Shared form action result shape — keep outside "use server" modules for client-safe type imports. */
export type FormActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
};
