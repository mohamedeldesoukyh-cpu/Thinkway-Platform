"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { documentationSlotDestinationLabel } from "@/lib/services/deliverables/documentation-list-groups";
import type { DocumentationUnitSummary } from "@/lib/services/deliverables/documentation-types";

type Props = {
  currentUnitKey: string;
  units: DocumentationUnitSummary[];
  disabled?: boolean;
  onMove: (targetUnitKey: string) => void;
  onRemove: () => void;
};

export function DocumentationAssetActions({
  currentUnitKey,
  units,
  disabled,
  onMove,
  onRemove,
}: Props) {
  const [targetKey, setTargetKey] = useState<string>("");
  const destinations = units.filter((unit) => unit.unitKey !== currentUnitKey);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Select
        value={targetKey || undefined}
        onValueChange={setTargetKey}
        disabled={disabled || destinations.length === 0}
      >
        <SelectTrigger className="h-8 min-w-[180px] flex-1 text-xs">
          <SelectValue placeholder="Move to another slot" />
        </SelectTrigger>
        <SelectContent>
          {destinations.map((unit) => (
            <SelectItem key={unit.unitKey} value={unit.unitKey}>
              {documentationSlotDestinationLabel(unit)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={disabled || !targetKey}
        onClick={() => {
          if (!targetKey) return;
          onMove(targetKey);
          setTargetKey("");
        }}
      >
        Move
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}
