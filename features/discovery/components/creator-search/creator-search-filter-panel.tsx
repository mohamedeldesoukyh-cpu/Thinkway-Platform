"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import {
  DiscoveryFilterActiveSummary,
  DiscoveryFilterDrawer,
  DiscoveryFilterDrawerFooter,
  DiscoveryFilterDrawerSection,
} from "@/features/discovery/components/design-system";

import {
  AiField,
  AudienceField,
  BrandSafetyField,
  CategoryField,
  CommercialPricingField,
  ContentSearchField,
  EngagementField,
  FollowerRangeField,
  LastPostField,
  LocationField,
  NameField,
  PlatformField,
} from "./creator-search-filter-fields";
import { creatorSearchFiltersUrlEqual } from "@/lib/creators/creator-search-url-params";
import {
  buildActiveFilterChips,
  clearCreatorSearchSectionFilters,
  cloneCreatorSearchFilters,
  creatorSearchSectionFilterCounts,
  type CreatorSearchFilterSectionId,
  type CreatorSearchFilters,
} from "./creator-search-types";

type Props = {
  open: boolean;
  filters: CreatorSearchFilters;
  onApply: (next: CreatorSearchFilters) => void;
  onClearAll: () => void;
  onClose?: () => void;
  loading?: boolean;
};

export function CreatorSearchFilterPanel({
  open,
  filters,
  onApply,
  onClearAll,
  onClose,
  loading,
}: Props) {
  const [draftFilters, setDraftFilters] = useState(() => cloneCreatorSearchFilters(filters));

  useEffect(() => {
    if (open) {
      setDraftFilters(cloneCreatorSearchFilters(filters));
    }
  }, [open, filters]);

  const sectionCounts = creatorSearchSectionFilterCounts(draftFilters);
  const hasDraftChanges = !creatorSearchFiltersUrlEqual(draftFilters, filters);

  const activeSummaryChips = useMemo(
    () =>
      buildActiveFilterChips(draftFilters).map((chip) => ({
        id: chip.id,
        label: chip.label,
        onRemove: () => setDraftFilters((prev) => ({ ...prev, ...chip.clear })),
      })),
    [draftFilters]
  );

  function clearSection(section: CreatorSearchFilterSectionId) {
    setDraftFilters((prev) => clearCreatorSearchSectionFilters(section, prev));
  }

  function handleApply() {
    if (hasDraftChanges) {
      onApply(cloneCreatorSearchFilters(draftFilters));
    }
    onClose?.();
  }

  function handleClearEverything() {
    onClearAll();
    setDraftFilters(cloneCreatorSearchFilters());
  }

  return (
    <DiscoveryFilterDrawer
      title="Search filters"
      onClose={onClose}
      activeSummary={
        <DiscoveryFilterActiveSummary
          chips={activeSummaryChips}
          onClearAll={handleClearEverything}
        />
      }
      footer={
        <DiscoveryFilterDrawerFooter
          onClear={handleClearEverything}
          onApply={handleApply}
          applyLabel={
            loading
              ? "Searching…"
              : hasDraftChanges
                ? "Apply filters"
                : "Show results"
          }
          clearLabel="Clear everything"
          loading={loading}
          disabled={!onClose}
        />
      }
    >
      <DiscoveryFilterDrawerSection
        sectionId="creator"
        title="Creator"
        icon={<UserIcon className="size-3" />}
        count={sectionCounts.creator}
        defaultOpen
        onClearSection={() => clearSection("creator")}
      >
        <NameField filters={draftFilters} onChange={setDraftFilters} />
        <PlatformField filters={draftFilters} onChange={setDraftFilters} />
        <CategoryField filters={draftFilters} onChange={setDraftFilters} />
        <LocationField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="search"
        title="Search"
        icon={<SearchIcon className="size-3" />}
        count={sectionCounts.search}
        onClearSection={() => clearSection("search")}
      >
        <ContentSearchField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="audience"
        title="Audience"
        icon={<UsersIcon className="size-3" />}
        count={sectionCounts.audience}
        onClearSection={() => clearSection("audience")}
      >
        <AudienceField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="performance"
        title="Performance"
        icon={<TrendingUpIcon className="size-3" />}
        count={sectionCounts.performance}
        onClearSection={() => clearSection("performance")}
      >
        <FollowerRangeField filters={draftFilters} onChange={setDraftFilters} />
        <EngagementField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="ai"
        title="AI Intelligence"
        icon={<SparklesIcon className="size-3" />}
        count={sectionCounts.ai}
        onClearSection={() => clearSection("ai")}
      >
        <AiField filters={draftFilters} onChange={setDraftFilters} />
        <BrandSafetyField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="advanced"
        title="Advanced"
        icon={<Settings2Icon className="size-3" />}
        count={sectionCounts.advanced}
        onClearSection={() => clearSection("advanced")}
      >
        <LastPostField filters={draftFilters} onChange={setDraftFilters} />
        <CommercialPricingField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>
    </DiscoveryFilterDrawer>
  );
}
