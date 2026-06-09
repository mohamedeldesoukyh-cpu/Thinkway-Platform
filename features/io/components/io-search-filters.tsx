"use client";

import { OperationalTableSearch } from "@/components/tables/operational-table-search";
import { OperationalTableUrlSelect } from "@/components/tables/operational-table-url-select";

type Props = {
  statuses: { value: string; label: string }[];
};

export function IoSearchFilters({ statuses }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <OperationalTableSearch placeholder="Search campaign, client, influencer..." />
      <OperationalTableUrlSelect
        paramKey="status"
        defaultValue="all"
        options={statuses}
        aria-label="Filter by status"
      />
    </div>
  );
}
