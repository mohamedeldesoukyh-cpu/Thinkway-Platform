import type { UnifiedCreatorBrowseFilters, UnifiedCreatorResult } from "@/lib/creators/types";

/** Single- or multi-select behavior for creator pickers. */
export type CreatorSelectionMode = "single" | "multi";

export type CreatorSelectionConfig = {
  mode: CreatorSelectionMode;
  /** When set, blocks selecting more than N creators (multi mode only). */
  maxSelection?: number;
};

export type CreatorCheckboxState = boolean | "indeterminate";

/** Keys used to dedupe creators already on a shortlist or similar list. */
export type ExistingCreatorKey = {
  unified_id: string | null;
  profile_id: string | null;
  influencer_id: string | null;
};

export type CreatorRowMeta = {
  id: string;
  label: string;
  sublabel?: string;
  metric?: string;
  disabled?: boolean;
  disabledBadge?: string;
  creator?: UnifiedCreatorResult;
};

export type CreatorSearchPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  platform: string;
  onPlatformChange: (value: string) => void;
  platformOptions?: Array<{ value: string; label: string }>;
  searchPlaceholder?: string;
  autoFocus?: boolean;
};

export type CreatorPickerPaginationMode = "page" | "infinite";

export type CreatorBrowseState = {
  creators: UnifiedCreatorResult[];
  total: number;
  page: number;
  pageSize: number;
  internalCount: number;
  discoveryCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
};

export type CreatorBrowseFilters = UnifiedCreatorBrowseFilters;

export type CreatorPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  selectionMode?: CreatorSelectionMode;
  maxSelection?: number;
  /** Pre-selected unified IDs when dialog opens. */
  initialSelectedIds?: string[];
  /** Called when user confirms selection (multi) or picks one row (single). */
  onConfirm?: (creators: UnifiedCreatorResult[]) => void;
  /** Browse filters passed to `browseUnifiedCreatorsAction`. */
  browseFilters?: Partial<CreatorBrowseFilters>;
  /** IDs/keys already present — rows show as disabled. */
  existingKeys?: Set<string>;
  /** When true, only production-safe creators are browsed. */
  productionOnly?: boolean;
  pageSize?: number;
  paginationMode?: CreatorPickerPaginationMode;
  confirmLabel?: string;
  formatConfirmLabel?: (selectedCount: number) => string;
  /** Custom row disable check beyond existing keys. */
  isRowDisabled?: (creator: UnifiedCreatorResult) => boolean;
  /** Show add-by-profile-link CTA when search returns no results. */
  showAddMissingCreator?: boolean;
  children?: React.ReactNode;
};

export const DEFAULT_PLATFORM_OPTIONS = [
  { value: "all", label: "All platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "snapchat", label: "Snapchat" },
  { value: "x", label: "X / Twitter" },
] as const;

export const CREATOR_PICKER_DEFAULT_PAGE_SIZE = 20;
export const CREATOR_PICKER_DEBOUNCE_MS = 220;
