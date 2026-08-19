"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAssignmentCommercialNotesAction } from "@/features/campaigns/actions";
import { useAssignmentGridEditSession } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-edit-session";
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
  const gridEdit = useAssignmentGridEditSession();
  const [text, setText] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const textRef = useRef(text);
  textRef.current = text;
  const valueRef = useRef(value);
  valueRef.current = value;

  const lockedBySession = gridEdit.hasSession && !gridEdit.isEditing;
  const displayOnly = readOnly || lockedBySession;

  useEffect(() => {
    setText(value ?? "");
  }, [value, gridEdit.discardEpoch]);

  useEffect(() => {
    if (!gridEdit.hasSession || readOnly) return;
    return gridEdit.registerFlush(`description:${lineId}`, async () => {
      const next = textRef.current.trim();
      const previous = (valueRef.current ?? "").trim();
      if (next === previous) return { ok: true };
      const result = await updateAssignmentCommercialNotesAction({
        campaign_id: campaignId,
        line_id: lineId,
        description: next || null,
      });
      if (!result.ok) {
        return { ok: false, message: result.message ?? "Could not save description." };
      }
      return { ok: true };
    });
  }, [campaignId, gridEdit, lineId, readOnly]);

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
      }
    });
  }

  if (displayOnly) {
    return (
      <p
        title={text.trim() || undefined}
        className={cn(
          "line-clamp-3 overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-snug text-foreground/90",
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
      onBlur={gridEdit.hasSession ? undefined : persist}
      rows={3}
      disabled={pending || gridEdit.saving}
      placeholder="Full description…"
      className={cn(
        "min-h-[3.25rem] w-full resize-y rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[11px] leading-snug text-foreground outline-none",
        "whitespace-pre-wrap break-words placeholder:text-muted-foreground/70",
        "hover:border-border/60 focus:border-primary/40 focus:bg-background",
        (pending || gridEdit.saving) && "opacity-70",
        className
      )}
      aria-label="Full description"
    />
  );
}
