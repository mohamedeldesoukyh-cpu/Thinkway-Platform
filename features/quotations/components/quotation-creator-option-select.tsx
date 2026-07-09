"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { optionNumberLabel } from "@/lib/quotations/quotation-deliverable-types";

type Props = {
  displayOptionNumber: number;
  optionSelectValues: number[];
  onChange: (value: string) => void;
};

/** Controlled option label dropdown — isolated so parent row hook order stays stable. */
export function QuotationCreatorOptionSelect({
  displayOptionNumber,
  optionSelectValues,
  onChange,
}: Props) {
  const value = String(displayOptionNumber);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-full max-w-[9rem] border-transparent bg-transparent px-0 text-xs font-bold shadow-none hover:bg-muted/40 focus:ring-0">
        <SelectValue placeholder="Option…">
          {optionNumberLabel(displayOptionNumber) ?? "—"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {optionSelectValues.map((option) => (
          <SelectItem key={option} value={String(option)} className="text-xs font-medium">
            {optionNumberLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
