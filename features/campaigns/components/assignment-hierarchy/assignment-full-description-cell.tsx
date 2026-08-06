"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAssignmentCommercialNotesAction } from "@/features/campaigns/actions";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  lineId: string;
  value: string | null;
  readOnly?: boolean;
  className?: string;
};

export function AssignmentFullDescriptionCell({
  campaignId,
  lineId,
  value,
  readOnly = false,
  className,
}: Props) {
  const [text, setText] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  function persist() {
    const next = text.trim();
    const previous = (value ?? "").trim();
    if (next === previous) return;
    startTransition(async () => {
      const result = await updateAssignmentCommercialNotesAction({
        campaign_id: campaignId,
        line_id: lineId,
        description: next || null,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not save description.");
        setText(value ?? "");
        return;
      }
    });
  }

  if (readOnly) {
    return (
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-[11px] leading-snug text-foreground/90",
          className
        )}
      >
        {text.trim() || "—"}
      </p>
    );
  }

  return (
    <textarea
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={persist}
      rows={3}
      disabled={pending}
      placeholder="Full description…"
      className={cn(
        "min-h-[3.25rem] w-full resize-y rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[11px] leading-snug text-foreground outline-none",
        "whitespace-pre-wrap break-words placeholder:text-muted-foreground/70",
        "hover:border-border/60 focus:border-primary/40 focus:bg-background",
        pending && "opacity-70",
        className
      )}
      aria-label="Full description"
    />
  );
}
