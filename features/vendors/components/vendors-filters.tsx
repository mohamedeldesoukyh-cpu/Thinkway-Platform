"use client";

import { OperationalTableUrlSelect } from "@/components/tables/operational-table-url-select";
import {
  PLATFORM_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";

const ALL_VALUE = "__all__";

export function VendorsFilters() {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <OperationalTableUrlSelect
        paramKey="status"
        defaultValue={ALL_VALUE}
        options={[
          { value: ALL_VALUE, label: "All statuses" },
          ...VENDOR_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        aria-label="Filter by status"
      />

      <OperationalTableUrlSelect
        paramKey="platform"
        defaultValue={ALL_VALUE}
        options={[
          { value: ALL_VALUE, label: "All platforms" },
          ...PLATFORM_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        aria-label="Filter by platform"
      />
    </div>
  );
}
