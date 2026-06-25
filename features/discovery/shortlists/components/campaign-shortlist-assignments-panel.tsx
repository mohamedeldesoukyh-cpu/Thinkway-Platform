"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  listCampaignShortlistAssignments,
  removeAssignmentPermanently,
  returnAssignmentToShortlist,
} from "../actions";
import type { ShortlistMovedAssignment } from "../types";
import { AssignmentStatusBadge } from "./shortlist-badges";

/**
 * Campaign workspace — Remove From Campaign (spec §10).
 * Lists creators that were moved here from a shortlist and offers:
 *   • Return to Original Shortlist
 *   • Remove Permanently
 */
export function CampaignShortlistAssignmentsPanel({
  campaignHeaderId,
}: {
  campaignHeaderId: string;
}) {
  const [assignments, setAssignments] = useState<ShortlistMovedAssignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const rows = await listCampaignShortlistAssignments(campaignHeaderId);
        setAssignments(rows);
      } finally {
        setLoaded(true);
      }
    });
  }, [campaignHeaderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function run(
    action: () => Promise<{ ok: boolean; message?: string }>
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? "Done");
          refresh();
        } else {
          toast.error(result.message ?? "Action failed");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  const active = assignments.filter((a) => a.assignment_status !== "removed");

  if (loaded && assignments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">From shortlists</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No active shortlist-sourced creators.
          </p>
        ) : (
          active.map((assignment) => (
            <div
              key={assignment.assignment_id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {assignment.influencer_name ?? "Creator"}
                </p>
                <AssignmentStatusBadge status={assignment.assignment_status} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isPending}>
                    Remove from campaign
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      run(() => returnAssignmentToShortlist(assignment.assignment_id));
                    }}
                  >
                    Return to original shortlist
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => {
                      event.preventDefault();
                      run(() => removeAssignmentPermanently(assignment.assignment_id));
                    }}
                  >
                    Remove permanently
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
