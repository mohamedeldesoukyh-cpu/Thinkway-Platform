"use client";

import { OperationalTableSearch } from "@/components/tables/operational-table-search";

export function CampaignsSearch() {
  return (
    <OperationalTableSearch
      placeholder="Search campaigns…"
      className="tw-search"
      inputClassName="tw-in"
      variant="boxed"
    />
  );
}
