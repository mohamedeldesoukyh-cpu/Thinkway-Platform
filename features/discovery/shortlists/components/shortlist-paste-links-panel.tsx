"use client";

import { Loader2Icon } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { MAX_SHORTLIST_PASTE_CREATORS } from "@/lib/discovery/add-creator-constants";
import { parseProfileInputList } from "@/lib/social/parse-profile-url";
import { cn } from "@/lib/utils";

import {
  describeShortlistPastePreview,
  shortlistPastePreview,
} from "../paste-links-policy";

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  pending?: boolean;
  disabled?: boolean;
};

export function ShortlistPasteLinksPanel({
  value,
  onChange,
  error,
  pending,
  disabled,
}: Props) {
  const parsed = parseProfileInputList(value);
  const preview = shortlistPastePreview(parsed.parsed.length, parsed.invalid.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f8fafc] px-4 py-4">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        autoComplete="off"
        autoFocus
        disabled={pending || disabled}
        placeholder={`https://www.instagram.com/username\nhttps://www.tiktok.com/@username\nhttps://www.youtube.com/@username`}
        className={cn(
          "min-h-[220px] resize-none rounded-lg border-[#e2e8f0] bg-white text-[13px] text-[#0f172a] shadow-none placeholder:text-[#94a3b8] focus-visible:border-[#2563eb] focus-visible:ring-[3px] focus-visible:ring-[rgba(37,99,235,0.12)]",
          "font-mono"
        )}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : pending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          Resolving links and adding to this shortlist…
        </p>
      ) : preview.parsedCount > 0 ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {describeShortlistPastePreview(preview)}
        </p>
      ) : value.trim().length >= 8 ? (
        <p className="text-xs text-muted-foreground">
          Enter supported social profile URLs, one per line or comma-separated.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Paste a full list of profile links. Existing Discovery creators are added;
          missing ones are created. Up to {MAX_SHORTLIST_PASTE_CREATORS} per batch.
        </p>
      )}
    </div>
  );
}
