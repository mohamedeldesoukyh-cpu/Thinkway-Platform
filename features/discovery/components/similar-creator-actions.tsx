"use client";
import type { ReactNode } from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export type SimilarCreatorTarget = { kind: "shortlist" | "quotation"; id: string; canAdd?: boolean };
export function SimilarCreatorActions({ children, name, onDetails, onCompare, onAdd, target, onMenuChange }: {
  children: ReactNode; name: string; onDetails: () => void; onCompare: () => void; onAdd: () => void;
  target?: SimilarCreatorTarget; onMenuChange: (open: boolean) => void;
}) {
  return <DropdownMenu onOpenChange={onMenuChange}>
    <DropdownMenuTrigger asChild><button type="button" className="w-full text-left rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600" aria-label={`Actions for ${name}`}>{children}</button></DropdownMenuTrigger>
    <DropdownMenuContent className="z-[200]" align="end">
      <DropdownMenuItem onSelect={onDetails}>Show details</DropdownMenuItem>
      <DropdownMenuItem onSelect={onCompare}>Compare</DropdownMenuItem>
      <DropdownMenuItem disabled={target?.canAdd === false} onSelect={onAdd}>Add to {target?.kind === "quotation" ? "quotation" : "shortlist"}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
