import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";

export function VendorsTableSkeleton() {
  return (
    <>
      <PlatformV6SectionMeta title="All vendors" meta="Loading vendors…" />
      <PlatformV6Toolbar>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </PlatformV6Toolbar>
      <PlatformV6SectionWrap>
        <CampaignOperationalTable>
          <CampaignOperationalTableHeader>
            <CampaignOperationalTableHeaderRow>
              {Array.from({ length: 11 }).map((_, index) => (
                <CampaignOperationalTableHead key={index}>
                  <Skeleton className="mx-auto h-3 w-14" />
                </CampaignOperationalTableHead>
              ))}
            </CampaignOperationalTableHeaderRow>
          </CampaignOperationalTableHeader>
          <CampaignOperationalTableBody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <CampaignOperationalTableRow key={rowIndex}>
                {Array.from({ length: 11 }).map((_, cellIndex) => (
                  <CampaignOperationalTableCell key={cellIndex}>
                    <Skeleton className="h-3 w-full max-w-[100px]" />
                  </CampaignOperationalTableCell>
                ))}
              </CampaignOperationalTableRow>
            ))}
          </CampaignOperationalTableBody>
        </CampaignOperationalTable>
      </PlatformV6SectionWrap>
    </>
  );
}
