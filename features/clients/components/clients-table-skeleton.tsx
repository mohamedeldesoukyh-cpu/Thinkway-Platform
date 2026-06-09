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

export function ClientsTableSkeleton() {
  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
      }
    >
      <CampaignOperationalTable>
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            {Array.from({ length: 6 }).map((_, index) => (
              <CampaignOperationalTableHead key={index}>
                <Skeleton className="mx-auto h-3 w-16" />
              </CampaignOperationalTableHead>
            ))}
          </CampaignOperationalTableHeaderRow>
        </CampaignOperationalTableHeader>
        <CampaignOperationalTableBody>
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <CampaignOperationalTableRow key={rowIndex}>
              {Array.from({ length: 6 }).map((_, cellIndex) => (
                <CampaignOperationalTableCell key={cellIndex}>
                  <Skeleton className="h-3 w-full max-w-[140px]" />
                </CampaignOperationalTableCell>
              ))}
            </CampaignOperationalTableRow>
          ))}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>
    </OperationalTableSection>
  );
}
