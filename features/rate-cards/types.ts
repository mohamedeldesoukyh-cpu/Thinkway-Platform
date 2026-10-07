/**
 * Domain + component contracts.
 * Every callback below is the seam where the implementation agent wires an
 * existing server action. The prototype passes simulated handlers.
 */
import type { Money, Currency, PeriodicPrice, TravelUplifts, BulkRule, BulkScope } from './lib/pricing';

export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'snapchat';
export type VersionStatus = 'active' | 'inactive';
export type Lang = 'en' | 'ar';

export interface Permissions {
  canEditPricing: boolean; canActivate: boolean;
  canDeleteVersion: boolean; canDeleteRateCard: boolean;
  canExport: boolean; canViewInternalCost: boolean;
}

export interface RateCardVersionSummary {
  id: string; rateCardId: string;
  clientId: string; clientName: string;
  /** null = the rate card applies at client level, not to one brand. */
  brandId: string | null; brandName: string | null;
  name: string; version: string; status: VersionStatus;
  createdAt: string; updatedAt: string;
  creatorCount: number;              // unique creators, not pricing lines
  currencies: Currency[];
}

export interface RegisterCounts {
  /** Versions matching the current filters across the whole result set. */
  matchingVersions: number;
  /** Active versions ON THIS PAGE ONLY. Never present as a system total. */
  activeOnPage: number;
  pageSize: number;                  // 25
  scopeLabel: string;                // "All clients" or the selected client
}

export interface VersionCounts {
  /** All of these describe the ENTIRE version, not the loaded page. */
  uniqueCreators: number;
  platformAccounts: number;          // once per creator per platform
  byPlatform: Partial<Record<Platform, number>>;
}

/** One visible offer. May resolve to several underlying pricing records. */
export interface Offer {
  id: string;
  creatorId: string; creatorName: string; creatorNameLocal: string | null;
  avatarUrl: string | null;
  /** Platforms INCLUDED IN THIS PACKAGE — not every account the creator owns. */
  platforms: Platform[];
  deliverableType: string;
  packageCode: string | null; packageName: string | null;
  composition: string | null;        // "1 reel, mirrored to included platforms"
  /** How many pricing records this one row represents. */
  pricingLineIds: string[];
  creatorCost: Money; clientPrice: Money;
  agencyFeePct: number | null;       // content fee only
  notes: string | null;              // internal, never exported
  usageRights: PeriodicPrice | null;
  boosting: PeriodicPrice | null;
  eventAttendance: PeriodicPrice | null;
  travel: TravelUplifts;
  rateCardPhotoUrl: string | null;   // overrides the creator photo for this card
}

/* ============================ component props ============================ */

export interface RateCardRegisterProps {
  rows: RateCardVersionSummary[];
  counts: RegisterCounts;
  permissions: Permissions;
  lang: Lang;
  loading?: boolean;
  filters: RegisterFilters;
  sort: { field: SortField; dir: 'asc' | 'desc' };
  page: number; totalRows: number;

  onFiltersChange(next: RegisterFilters): void;
  onSortChange(field: SortField, dir: 'asc' | 'desc'): void;
  onPageChange(page: number): void;
  onLangChange(lang: Lang): void;
  onOpenVersion(versionId: string): void;
  onCreate(): void;
  onEdit(versionId: string): void;
  onDuplicate(versionId: string): void;          // the copy starts inactive
  onUploadInto(versionId: string): void;
  onToggleActive(versionId: string, next: VersionStatus): void;
  /** Deletes ONE version. Other versions of the rate card survive. */
  onDeleteVersion(versionId: string): Promise<void>;
  /** Deletes the rate card and EVERY version of it. */
  onDeleteRateCard(rateCardId: string): Promise<void>;
  onDownloadTemplate(kind: 'individual' | 'packages'): void;
  onRefresh(): void;
}

export type SortField =
  | 'name' | 'version' | 'createdAt' | 'updatedAt' | 'creatorCount' | 'clientName';

export interface RegisterFilters {
  search: string; clientId: string | null; brandId: string | null;
  creatorQuery: string; status: VersionStatus | null;
  version: string | null; platform: Platform | null; currency: Currency | null;
}

export interface RateCardVersionProps {
  version: RateCardVersionSummary;
  counts: VersionCounts;
  offers: Offer[];
  permissions: Permissions;
  lang: Lang;
  loading?: boolean;
  /** Set when the server reports the version changed since this view loaded. */
  staleSince?: string | null;
  page: number; pageSize: number; totalOffers: number;
  filters: { search: string; platform: Platform | null; currency: Currency | null };

  onBack(): void;
  onFiltersChange(next: RateCardVersionProps['filters']): void;
  onPageChange(page: number): void;
  onLangChange(lang: Lang): void;

  onAddPricingLine(draft: PricingLineDraft): Promise<void>;
  onEditPricingLine(lineId: string, draft: Partial<PricingLineDraft>): Promise<void>;
  /** Receives PRICING LINE ids, expanded from the selected offers. */
  onRemovePricingLines(lineIds: string[]): Promise<void>;
  onAddFromDiscovery(): void;
  onUpload(): void;
  onChangePhoto(offerId: string, source: { kind: 'upload'; file: File } | { kind: 'url'; url: string } | { kind: 'reset' }): Promise<void>;

  onApplyBulkPricing(rule: BulkRule, scope: BulkScope, lineIds: string[]): Promise<void>;
  onPreviewBulkPricing(rule: BulkRule, scope: BulkScope, lineIds: string[]): Promise<unknown>;

  /** Per-offer uplift edit. */
  onSaveUplifts(offerId: string, uplifts: Partial<TravelUplifts>): Promise<void>;
  /**
   * Version-wide. Applies to EVERY creator in the version, including other
   * pages and rows hidden by filters. Must be confirmed before calling.
   */
  onApplyUpliftsToVersion(uplifts: Partial<TravelUplifts>): Promise<void>;

  onExport(report: ExportReport, format: ExportFormat): Promise<void>;
  onOpenAuditHistory(): void;
}

export interface PricingLineDraft {
  creatorId: string | null; profileUrl: string | null;
  platform: Platform; deliverableType: string;
  rateType: 'creatorCost' | 'clientPrice';
  amount: number; currency: Currency;
  agencyFeePct: number | null; notes: string | null;
  usageRightsMonths: number | null; boostingMonths: number | null;
  eventDays: number | null;
}

export type ExportReport = 'creatorList' | 'creatorListDetailed' | 'clientListByName';
export type ExportFormat = 'htmlPreview' | 'html' | 'pdf' | 'pptx';

export interface AuditEntry {
  id: string; at: string; actorName: string; action: string; version: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
}
