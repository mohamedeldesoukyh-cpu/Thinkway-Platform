"use client";

import Link from "next/link";
import { ChevronDown, FileText, Layers, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type InvoiceViewMenuProps = {
  invoiceId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
};

export function InvoiceViewMenu({
  invoiceId,
  label = "View invoice",
  size = "sm",
  variant = "outline",
}: InvoiceViewMenuProps) {
  const base = `/billing/invoices/${invoiceId}/preview`;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          {label}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Invoice layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=detailed`} className="flex cursor-pointer items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Detailed</span>
              <span className="block text-xs text-muted-foreground">
                One line per deliverable / post
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=by_creator`} className="flex cursor-pointer items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">By creator</span>
              <span className="block text-xs text-muted-foreground">
                Amounts rolled up by campaign line
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=package`} className="flex cursor-pointer items-start gap-2">
            <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Summary</span>
              <span className="block text-xs text-muted-foreground">
                Lump-sum campaign + agency fees
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
