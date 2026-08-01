"use client";

import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canRecordVendorIoManualApproval,
  VendorIoManualApproveButton,
} from "@/features/io/components/vendor-io-manual-approve-button";
import { VendorIoSendButton } from "@/features/io/components/vendor-io-send-button";
import type { VendorIoRow } from "@/features/io/types";

type Props = {
  row: VendorIoRow;
  onViewDetail: (ioId: string) => void;
};

/** Compact Actions cell — primary Send + overflow menu (no horizontal page scroll). */
export function VendorIoRowActions({ row, onViewDetail }: Props) {
  const signedUrl = row.attachment_url?.trim() || "";
  const canApprove = canRecordVendorIoManualApproval(row);

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      <VendorIoSendButton
        row={row}
        variant="default"
        size="sm"
        className="h-7 max-w-[7.25rem] truncate px-2 text-[11px] font-semibold"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            aria-label="More Vendor IO actions"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => onViewDetail(row.id)}>
            Details
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/ios/vendor/${row.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View IO
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/api/vendor-ios/${row.id}/document?format=pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open PDF
            </a>
          </DropdownMenuItem>
          {signedUrl ? (
            <DropdownMenuItem asChild>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                Open signed copy
              </a>
            </DropdownMenuItem>
          ) : null}
          {canApprove ? (
            <>
              <DropdownMenuSeparator />
              <div className="px-1.5 py-1" onClick={(event) => event.stopPropagation()}>
                <VendorIoManualApproveButton
                  row={row}
                  size="sm"
                  variant="outline"
                  className="h-8 w-full justify-center text-[11px]"
                />
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
