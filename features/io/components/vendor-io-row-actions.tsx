"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

import { VendorIoCancelTrigger } from "./vendor-io-cancel-dialog";
import { isActiveVendorIo } from "@/lib/io/active-vendor-io";

type Props = {
  row: VendorIoRow;
  onViewDetail: (ioId: string) => void;
  compact?: boolean;
};

/** Primary delivery action and the existing overflow options. */
export function VendorIoRowActions({ row, onViewDetail, compact = false }: Props) {
  const openingDetails = useRef(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const signedUrl = row.attachment_url?.trim() || "";
  const canApprove = canRecordVendorIoManualApproval(row);

  if (compact) {
    return (
      <div className="wr-vio-reference-actions">
        <Button size="sm" variant="outline" onClick={() => onViewDetail(row.id)}>Open</Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Vendor IO delivery and more actions"><MoreHorizontalIcon className="size-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="end">
            <p className="mb-2 text-xs font-semibold">Delivery and document actions</p>
            <VendorIoRowActions row={row} onViewDetail={onViewDetail} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      <VendorIoSendButton row={row} variant="default" size="sm" compact className="h-7 shrink-0 whitespace-nowrap px-2.5 text-[11px] font-semibold" />
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
        <DropdownMenuContent
          align="end"
          className="w-48"
          onCloseAutoFocus={(event) => {
            // Keep focus in the newly opened drawer instead of dismissing it
            // by returning focus to the menu trigger outside the drawer.
            if (openingDetails.current) {
              event.preventDefault();
              openingDetails.current = false;
            }
          }}
        >
          <DropdownMenuItem onSelect={() => {
            openingDetails.current = true;
            onViewDetail(row.id);
          }}>
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
              href={`/api/vendor-ios/${row.id}/document?format=pdf&download=1`}
              download
            >
              Download PDF
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
          {isActiveVendorIo(row) ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50" onSelect={() => { openingDetails.current = true; setCancelOpen(true); }}>Cancel IO</DropdownMenuItem></> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <VendorIoCancelTrigger row={row} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}
