"use client";

import { Input } from "@/components/ui/input";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";
import { QuotationPostTypeMultiSelect } from "@/features/quotations/components/quotation-post-type-multi-select";
import {
  formatTypeLinesSummary,
  normalizeTypeLineQuantity,
  quotationPostTypeLabel,
  selectedTypesFromTypeLines,
  typeLinesFromSelectedTypes,
} from "@/lib/quotations/quotation-deliverable-types";

function parseTypeLineQuantity(value: string): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

type ChangeOptions = {
  /** When false, keep the new lines in local UI only (e.g. empty row from +). */
  persist?: boolean;
};

type Props = {
  lines: QuotationDeliverableTypeLine[];
  allowedPlatforms: string[];
  onChange: (lines: QuotationDeliverableTypeLine[], options?: ChangeOptions) => void;
  disabled?: boolean;
  /** Open the type picker on mount (e.g. after adding a manual row). */
  defaultOpen?: boolean;
};

export function QuotationDeliverableTypeLinesEditor({
  lines,
  allowedPlatforms,
  onChange,
  disabled,
  defaultOpen,
}: Props) {
  const displayLines = lines.length > 0 ? lines : [{ type: "", quantity: 1 }];
  const selectedTypes = selectedTypesFromTypeLines(displayLines);
  const summaryLabel = formatTypeLinesSummary(displayLines);
  const showPerTypeQuantity =
    selectedTypes.length > 1 ||
    (selectedTypes.length === 1 &&
      normalizeTypeLineQuantity(displayLines.find((line) => line.type.trim())?.quantity) !== 1);

  function handleTypesChange(types: string[]) {
    onChange(typeLinesFromSelectedTypes(types, displayLines));
  }

  function updateTypeQuantity(type: string, quantity: number) {
    onChange(
      displayLines.map((line) =>
        line.type === type
          ? { ...line, quantity: normalizeTypeLineQuantity(quantity) }
          : line
      )
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1">
        {!showPerTypeQuantity && selectedTypes.length === 1 ? (
          <Input
            className="h-8 w-11 shrink-0 px-1 text-center text-xs tabular-nums"
            inputMode="numeric"
            min={1}
            step={1}
            disabled={disabled}
            value={String(
              normalizeTypeLineQuantity(
                displayLines.find((line) => line.type === selectedTypes[0])?.quantity
              )
            )}
            onChange={(event) =>
              updateTypeQuantity(selectedTypes[0]!, parseTypeLineQuantity(event.target.value))
            }
            aria-label={`Units for ${quotationPostTypeLabel(selectedTypes[0]!)}`}
          />
        ) : null}
        <QuotationPostTypeMultiSelect
          value={selectedTypes}
          onChange={handleTypesChange}
          allowedPlatforms={allowedPlatforms}
          disabled={disabled}
          summaryLabel={summaryLabel}
          className="min-w-0 flex-1"
          defaultOpen={defaultOpen}
        />
      </div>
      {showPerTypeQuantity
        ? selectedTypes.map((type) => {
            const line = displayLines.find((entry) => entry.type === type);
            return (
              <div key={type} className="flex items-center gap-1 pl-0.5">
                <Input
                  className="h-8 w-11 shrink-0 px-1 text-center text-xs tabular-nums"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  disabled={disabled}
                  value={String(normalizeTypeLineQuantity(line?.quantity))}
                  onChange={(event) =>
                    updateTypeQuantity(type, parseTypeLineQuantity(event.target.value))
                  }
                  aria-label={`Units for ${quotationPostTypeLabel(type)}`}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {quotationPostTypeLabel(type)}
                </span>
              </div>
            );
          })
        : null}
    </div>
  );
}
