"use client";

import { useState } from "react";

import { OperationalTableFilterSheet } from "@/components/tables/operational-table-filter-sheet";
import { OperationalTableSortButton } from "@/components/tables/operational-table-sort-popover";
import { OperationalTableSettingsButton } from "@/components/tables/operational-table-settings-button";
import { AssignmentGridSettingsButton } from "@/components/tables/assignment-grid-settings-button";
import {
  OperationalTableActionCluster,
  OperationalTableIcons,
  OperationalTableToolbarButton,
} from "@/components/tables/operational-table-chrome";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { hasActiveFilters } from "@/lib/tables/operational-table-filter-sort";

type OperationalTableControlsProps = {
  contextLabel: string;
  showFilter?: boolean;
  showSort?: boolean;
  showSettings?: boolean;
  /** Dual Main/Child column picker for assignment hierarchy grids. */
  columnSettings?: "default" | "assignment-grid";
};

export function OperationalTableControls({
  contextLabel,
  showFilter = true,
  showSort = true,
  showSettings = true,
  columnSettings = "default",
}: OperationalTableControlsProps) {
  const dataContext = useOperationalTableDataContextOptional();
  const [filterOpen, setFilterOpen] = useState(false);

  const filterActive = dataContext ? hasActiveFilters(dataContext.filters) : false;
  const hasActions =
    (showFilter && dataContext) || (showSort && dataContext) || showSettings;

  if (!hasActions) {
    return null;
  }

  return (
    <>
      <OperationalTableActionCluster>
        {showFilter && dataContext ? (
          <OperationalTableToolbarButton
            icon={OperationalTableIcons.filter}
            label="Filter"
            active={filterActive}
            onClick={() => setFilterOpen(true)}
          />
        ) : null}
        {showSort && dataContext ? <OperationalTableSortButton /> : null}
        {showSettings ? (
          columnSettings === "assignment-grid" ? (
            <AssignmentGridSettingsButton contextLabel={contextLabel} />
          ) : (
            <OperationalTableSettingsButton contextLabel={contextLabel} />
          )
        ) : null}
      </OperationalTableActionCluster>
      {dataContext ? (
        <OperationalTableFilterSheet open={filterOpen} onOpenChange={setFilterOpen} />
      ) : null}
    </>
  );
}

export function OperationalTableControlsSlot(props: OperationalTableControlsProps) {
  return <OperationalTableControls {...props} />;
}
