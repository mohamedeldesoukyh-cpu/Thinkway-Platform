"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { format } from "date-fns";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShortlistStatus } from "@/types/database";

import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  rejectShortlist,
  reopenShortlist,
  submitShortlistForReview,
} from "../actions";
import type { ShortlistListRow } from "../types";
import {
  ShortlistStatusBadge,
  ShortlistVisibilityBadge,
} from "./shortlist-badges";

type RowAction = {
  label: string;
  run: () => Promise<{ ok: boolean; message?: string }>;
  show: (status: ShortlistStatus) => boolean;
  destructive?: boolean;
};

export function ShortlistsList({ shortlists }: { shortlists: ShortlistListRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? "Done");
          router.refresh();
        } else {
          toast.error(result.message ?? "Action failed");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  const actionsFor = (row: ShortlistListRow): RowAction[] => [
    {
      label: "Submit for review",
      run: () => submitShortlistForReview(row.id),
      show: (s) => s === "draft",
    },
    {
      label: "Approve",
      run: () => approveShortlist(row.id),
      show: (s) => s === "under_review",
    },
    {
      label: "Return to draft",
      run: () => rejectShortlist(row.id),
      show: (s) => s === "under_review",
    },
    {
      label: "Reopen",
      run: () => reopenShortlist(row.id),
      show: (s) => s === "cancelled",
    },
    {
      label: "Cancel",
      run: () => cancelShortlist(row.id),
      show: (s) => s === "draft" || s === "under_review" || s === "approved",
      destructive: true,
    },
    {
      label: "Archive",
      run: () => archiveShortlist(row.id),
      show: (s) => s !== "archived",
      destructive: true,
    },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Serial</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="text-right">Creators</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shortlists.map((row) => {
            const actions = actionsFor(row).filter((a) => a.show(row.status));
            return (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.serial_number ?? "—"}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/discovery/shortlists/${row.id}`}
                    className="hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.brand_name ? (
                    <span className="block text-xs text-muted-foreground">
                      {row.brand_name}
                      {row.client_name ? ` · ${row.client_name}` : ""}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <ShortlistStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <ShortlistVisibilityBadge visibility={row.visibility} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.owner_name ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.creator_count}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.updated_at
                    ? format(new Date(row.updated_at), "MMM d, yyyy")
                    : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        aria-label="Shortlist actions"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/discovery/shortlists/${row.id}`}>Open</Link>
                      </DropdownMenuItem>
                      {actions.length > 0 ? <DropdownMenuSeparator /> : null}
                      {actions.map((action) => (
                        <DropdownMenuItem
                          key={action.label}
                          variant={action.destructive ? "destructive" : "default"}
                          onSelect={(event) => {
                            event.preventDefault();
                            runAction(action.run);
                          }}
                        >
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
