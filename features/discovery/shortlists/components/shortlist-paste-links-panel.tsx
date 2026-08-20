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
  const unrecognized = parsed.invalid;

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
      ) : unrecognized.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {unrecognized.length} unrecognized link
          {unrecognized.length === 1 ? "" : "s"}. Fix these and paste again.
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
      {!pending && unrecognized.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/40">
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            Unrecognized links — fix or remove these
          </p>
          <ul className="mt-1.5 max-h-36 space-y-1 overflow-y-auto">
            {unrecognized.map((link, index) => (
              <li
                key={`${index}:${link}`}
                className="break-all font-mono text-[11px] leading-snug text-amber-900 dark:text-amber-200"
              >
                {link}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
