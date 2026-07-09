"use client";

import type { CreatorChangeDelta } from "@/features/campaign-decision-engine";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CreatorActionControlsProps = {
  creators: Array<{ id: string; displayName?: string; handle?: string }>;
  onAction: (action: CreatorChangeDelta) => void;
  bare?: boolean;
  className?: string;
};

const ACTIONS: Array<{
  label: string;
  build: (creatorId: string) => CreatorChangeDelta;
}> = [
  { label: "Remove", build: (id) => ({ action: "remove", creatorId: id }) },
  {
    label: "Replace",
    build: (id) => ({
      action: "replace",
      creatorId: id,
      replacementCreatorId: `alt_${id}`,
      source: "thinkway",
    }),
  },
  {
    label: "Add",
    build: () => ({ action: "add", creatorId: `new_creator_${Date.now()}`, source: "thinkway" }),
  },
  {
    label: "Client Creator",
    build: (id) => ({
      action: "replace",
      creatorId: id,
      replacementCreatorId: `client_${id}`,
      source: "client",
    }),
  },
  {
    label: "Increase Posts",
    build: (id) => ({ action: "increase_posts", creatorId: id, postCountDelta: 1 }),
  },
  {
    label: "Decrease Posts",
    build: (id) => ({ action: "decrease_posts", creatorId: id, postCountDelta: 1 }),
  },
  {
    label: "Change Platform",
    build: (id) => ({ action: "switch_platform", creatorId: id, targetPlatform: "tiktok" }),
  },
];

export function CreatorActionControls({
  creators,
  onAction,
  bare = false,
  className,
}: CreatorActionControlsProps) {
  const primaryCreator = creators[0]?.id ?? "creator_1";

  const buttons = (
    <div className="flex flex-wrap gap-1.5">
      {ACTIONS.map(({ label, build }) => (
        <Button
          key={label}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => onAction(build(label === "Add" ? primaryCreator : primaryCreator))}
        >
          {label}
        </Button>
      ))}
    </div>
  );

  if (bare) {
    return <div className={className}>{buttons}</div>;
  }

  return (
    <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Creator Actions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Target: {creators[0]?.displayName ?? creators[0]?.handle ?? "Primary creator"}
        </p>
      </CardHeader>
      <CardContent>{buttons}</CardContent>
    </Card>
  );
}
