import { OperationalTableSection } from "@/components/ui/operational-table-section";
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
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-32" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      }
    >
      <CampaignOperationalTable>
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            {Array.from({ length: 9 }).map((_, index) => (
              <CampaignOperationalTableHead key={index}>
                <Skeleton className="mx-auto h-3 w-14" />
              </CampaignOperationalTableHead>
            ))}
          </CampaignOperationalTableHeaderRow>
        </CampaignOperationalTableHeader>
        <CampaignOperationalTableBody>
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <CampaignOperationalTableRow key={rowIndex}>
              {Array.from({ length: 9 }).map((_, cellIndex) => (
                <CampaignOperationalTableCell key={cellIndex}>
                  <Skeleton className="h-3 w-full max-w-[100px]" />
                </CampaignOperationalTableCell>
              ))}
            </CampaignOperationalTableRow>
          ))}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>
    </OperationalTableSection>
  );
}
