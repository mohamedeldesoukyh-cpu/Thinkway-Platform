/**
 * Per-user Commercial Workspace column visibility (localStorage).
 */

export type CommercialWorkspaceColumnId =
  | "revenue"
  | "cost"
  | "gp"
  | "gpPct"
  | "gpPctInput"
  | "afPct"
  | "fx"
  | "currency"
  | "mode";

export type CommercialWorkspaceColumnPrefs = Record<
  CommercialWorkspaceColumnId,
  boolean
>;

export const DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS: CommercialWorkspaceColumnPrefs =
  {
    revenue: true,
    cost: true,
    gp: true,
    gpPct: true,
    gpPctInput: true,
    afPct: true,
    fx: false,
    currency: true,
    mode: true,
  };

const LEGACY_STORAGE_KEY = "tw:quotation-commercial-workspace:columns";
const STORAGE_KEY = `${LEGACY_STORAGE_KEY}:v2`;

export function readCommercialWorkspaceColumnPrefs(): CommercialWorkspaceColumnPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      return { ...DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS, ...(legacy ? JSON.parse(legacy) : {}), afPct: true };
    }
    const parsed = JSON.parse(raw) as Partial<CommercialWorkspaceColumnPrefs>;
    return { ...DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS, ...parsed };
  } catch {
    return { ...DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS };
  }
}

export function writeCommercialWorkspaceColumnPrefs(
  prefs: CommercialWorkspaceColumnPrefs
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

export const COMMERCIAL_WORKSPACE_COLUMN_LABELS: Record<
  CommercialWorkspaceColumnId,
  string
> = {
  revenue: "Base revenue",
  cost: "Cost",
  gp: "GP margin (incl. fees)",
  gpPct: "GP %",
  gpPctInput: "GP % input",
  afPct: "Agency fee % and amount",
  fx: "FX",
  currency: "Currency",
  mode: "Mode",
};
