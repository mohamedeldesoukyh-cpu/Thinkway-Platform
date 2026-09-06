"use client";

import { Suspense, type ReactNode } from "react";

import "@/app/styles/vendors-list-suite.css";

import {
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VendorsEmptyState } from "@/features/vendors/components/vendors-empty-state";
import { VendorsFilters } from "@/features/vendors/components/vendors-filters";
import { VendorsPagination } from "@/features/vendors/components/vendors-pagination";
import { VendorsSearch } from "@/features/vendors/components/vendors-search";
import { VENDORS_TABLE_COLUMNS, VendorsTable } from "@/features/vendors/components/vendors-table";
import type { VendorsListResult } from "@/features/vendors/queries";
import { formatFollowers, getTotalFollowers } from "@/features/vendors/utils";
import { VENDORS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { InfluencerStatus } from "@/types/database";

type VendorsListSectionProps = {
  vendors: VendorsListResult["vendors"];
  total: number;
  meta: string;
  hasFilters: boolean;
  page: number;
  totalPages: number;
  search: string;
  status?: InfluencerStatus;
  platform?: string;
  crmOnly?: boolean;
  errorSlot?: ReactNode;
  headerActions?: ReactNode;
};

function hasPricing(rateCard: unknown): boolean {
  if (!rateCard || typeof rateCard !== "object") return false;
  return Object.values(rateCard as Record<string, unknown>).some((value) => {
    if (value == null) return false;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "object") return Object.keys(value as object).length > 0;
    return true;
  });
}

function buildKpis(vendors: VendorsListResult["vendors"], total: number, totalPages: number) {
  const withAssignments = vendors.filter((v) => (v.assignment_count ?? 0) > 0).length;
  const complete = vendors.filter(
    (v) => typeof v.completeness_score === "number" && v.completeness_score >= 100
  ).length;
  const withPricing = vendors.filter((v) => hasPricing(v.rate_card)).length;
  const withAgency = vendors.filter((v) => Boolean(v.legal_name?.trim())).length;
  const platforms = new Set(
    vendors.flatMap((v) => (v.platform_accounts ?? []).map((a) => a.platform).filter(Boolean))
  ).size;
  const countries = new Set(
    vendors.flatMap((v) => {
      const codes = [...(v.country_codes ?? [])];
      if (v.country_code) codes.push(v.country_code);
      return codes.filter(Boolean);
    })
  ).size;
  const active = vendors.filter((v) => v.status === "active").length;
  const followerSum = vendors.reduce(
    (sum, v) => sum + getTotalFollowers(v.platform_accounts),
    0
  );
  const avgFollowers =
    vendors.length > 0 ? formatFollowers(Math.round(followerSum / vendors.length)) : "—";

  return [
    ["Creators", String(total), ""],
    ["With assignments", String(withAssignments), withAssignments ? "" : "r"],
    ["Profile complete", String(complete), complete ? "g" : "r"],
    ["With pricing", String(withPricing), withPricing ? "" : "r"],
    ["With an agency", String(withAgency), withAgency ? "" : "r"],
    ["Platforms", String(platforms), ""],
    ["Countries", String(countries), ""],
    ["Active", String(active), active ? "g" : ""],
    ["Avg followers", avgFollowers, ""],
    ["Pages", String(totalPages), ""],
  ] as const;
}

export function VendorsListSection({
  vendors,
  total,
  meta,
  hasFilters,
  page,
  totalPages,
  search,
  status,
  platform,
  crmOnly = true,
  errorSlot,
  headerActions,
}: VendorsListSectionProps) {
  const kpis = buildKpis(vendors, total, totalPages);
  const incompleteHint =
    vendors.length > 0 &&
    vendors.every(
      (v) =>
        (typeof v.completeness_score !== "number" || v.completeness_score === 0) &&
        !hasPricing(v.rate_card) &&
        (v.assignment_count ?? 0) === 0
    );

  return (
    <div className="vendors-list-suite">
      <div className="tw-frozen">
        <div className="tw-mast">
          <div className="tw-mh">
            <span className="tw-hmk" aria-hidden>
              <i />
              <u />
            </span>
            <span className="tw-hwd">
              THINK<em>WAY</em>
            </span>
            <span className="tw-hdv" />
            <h1>Commercial CRM</h1>
            <span className="st">{total} creators</span>
            <span className="sub">
              {crmOnly
                ? "creators with an active commercial relationship — Discovery stays separate until converted"
                : "full identity inventory (Commercial CRM filter temporarily off)"}
            </span>
            <span style={{ flex: 1 }} />
            {headerActions}
          </div>
          <div className="tw-ms2" aria-label="Commercial CRM metrics">
            {kpis.map(([label, value, tone]) => (
              <div key={label}>
                <i>{label}</i>
                <b className={tone || undefined}>{value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tw-main">
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.vendors}
          columns={VENDORS_TABLE_COLUMNS}
          rows={vendors}
          filterAccessors={VENDORS_TABLE_FILTER_ACCESSORS}
        >
          <div className="tw-c">
            <div className="tw-ch">
              <span className="tw-ct">
                {crmOnly ? "Commercial creators" : "All identities"}
              </span>
              <span className="tw-cs">{meta}</span>
              <span style={{ flex: 1 }} />
            </div>
            <PlatformV6Toolbar>
              <Suspense fallback={null}>
                <OperationalTableToolbar contextLabel="Commercial CRM">
                  <VendorsSearch />
                  <VendorsFilters />
                </OperationalTableToolbar>
              </Suspense>
            </PlatformV6Toolbar>

            <PlatformV6SectionWrap>
              {errorSlot}

              {incompleteHint ? (
                <div className="tw-note bad">
                  <b>
                    Creators on this page look incomplete — unpriced, unassigned, or missing
                    completeness.
                  </b>{" "}
                  Treat this as a contact list until enrichment and commercial fields are filled.
                </div>
              ) : null}

              {vendors.length === 0 ? (
                <VendorsEmptyState hasFilters={hasFilters} crmOnly={crmOnly} />
              ) : (
                <>
                  <VendorsTable vendors={vendors} />
                  <div className="tw-pg">
                    <VendorsPagination
                      page={page}
                      totalPages={totalPages}
                      search={search}
                      status={status}
                      platform={platform}
                    />
                  </div>
                </>
              )}
            </PlatformV6SectionWrap>
          </div>
        </OperationalTableSuiteProvider>
      </div>
    </div>
  );
}
