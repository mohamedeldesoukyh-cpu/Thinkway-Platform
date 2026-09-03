"use client";

import Link from "next/link";
import { ChevronDown, FileText, Layers, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ClientIoViewMenuProps = {
  clientIoId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  buttonClassName?: string;
  showChevron?: boolean;
};

export function ClientIoViewMenu({
  clientIoId,
  label = "View Client IO",
  size = "sm",
  variant = "default",
  buttonClassName,
  showChevron = true,
}: ClientIoViewMenuProps) {
  const base = `/ios/client/${clientIoId}/preview`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={
            buttonClassName ??
            "thinkway-campaign-btn thinkway-campaign-btn-primary h-[38px] gap-1.5 px-[15px] text-[13px]"
          }
        >
          {label}
          {showChevron ? <ChevronDown className="size-3.5 opacity-80" aria-hidden /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Client IO layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=detailed`} className="flex cursor-pointer items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Detailed</span>
              <span className="block text-xs text-muted-foreground">
                Pricing per assignment line
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=package`} className="flex cursor-pointer items-start gap-2">
            <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Package</span>
              <span className="block text-xs text-muted-foreground">
                Single campaign total
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`${base}?layout=package_main`}
            className="flex cursor-pointer items-start gap-2"
          >
            <LayoutList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Package main</span>
              <span className="block text-xs text-muted-foreground">
                Package totals with main assignment lines only
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
