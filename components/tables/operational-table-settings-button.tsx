"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  operationalTableChrome,
  OperationalTableIcons,
  OperationalTableToolbarButton,
} from "@/components/tables/operational-table-chrome";
import { OperationalTableColumnSettingsList } from "@/components/tables/operational-table-column-settings-list";
import { useOperationalTableColumnsContext } from "@/components/tables/operational-table-column-context";
import { cn } from "@/lib/utils";

type OperationalTableSettingsButtonProps = {
  contextLabel: string;
};

export function OperationalTableSettingsButton({
  contextLabel,
}: OperationalTableSettingsButtonProps) {
  const columnSettings = useOperationalTableColumnsContext();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <OperationalTableToolbarButton
          icon={OperationalTableIcons.settings}
          label="Settings"
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          operationalTableChrome.panelShell,
          "w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0"
        )}
      >
        <div className="border-b border-border/50 px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {contextLabel}
          </p>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Table settings
          </h3>
        </div>

        <div className="px-4 py-3">
          <OperationalTableColumnSettingsList {...columnSettings} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
