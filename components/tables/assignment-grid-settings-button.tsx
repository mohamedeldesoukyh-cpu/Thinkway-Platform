"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  operationalTableChrome,
  OperationalTableIcons,
  OperationalTableToolbarButton,
} from "@/components/tables/operational-table-chrome";
import { OperationalTableColumnSettingsList } from "@/components/tables/operational-table-column-settings-list";
import {
  useOperationalTableChildColumnsContext,
  useOperationalTableColumnsContext,
} from "@/components/tables/operational-table-column-context";
import { cn } from "@/lib/utils";

type AssignmentGridSettingsButtonProps = {
  contextLabel: string;
};

export function AssignmentGridSettingsButton({
  contextLabel,
}: AssignmentGridSettingsButtonProps) {
  const parentSettings = useOperationalTableColumnsContext();
  const childSettings = useOperationalTableChildColumnsContext();

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

        <Tabs defaultValue="main" className="gap-0">
          <div className="border-b border-border/50 px-4 pt-3 pb-2">
            <TabsList className="h-8 w-full">
              <TabsTrigger value="main" className="flex-1 px-2 text-xs">
                Main
              </TabsTrigger>
              <TabsTrigger value="child" className="flex-1 px-2 text-xs">
                Child
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="main" className="px-4 py-3">
            <OperationalTableColumnSettingsList {...parentSettings} />
          </TabsContent>
          <TabsContent value="child" className="px-4 py-3">
            <OperationalTableColumnSettingsList {...childSettings} />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
