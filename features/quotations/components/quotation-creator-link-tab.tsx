"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCreatorByProfileUrlAction } from "@/features/discovery/add-creator-by-url/actions";
import { addItemsToQuotation } from "@/features/quotations/actions";
import { buildQuotationSeedFromCreator } from "@/features/quotations/shortlist-seeds";
import { parseProfileInputList } from "@/lib/social/parse-profile-url";

export function QuotationCreatorLinkTab({ quotationId, onAdded }: {
  quotationId: string;
  onAdded: (result: { itemIds?: string[] }) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addCreator() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const parsed = parseProfileInputList(url);
        if (parsed.parsed.length !== 1 || parsed.invalid.length) {
          throw new Error("Paste one valid creator profile link, not a post or video link.");
        }
        const resolved = await addCreatorByProfileUrlAction(parsed.parsed[0].normalized_profile_url);
        if (!resolved.ok) throw new Error(resolved.message);
        if (!resolved.creator) throw new Error("The creator profile is being prepared. Please try this link again shortly.");
        const added = await addItemsToQuotation(quotationId, [buildQuotationSeedFromCreator(resolved.creator)]);
        if (!added.ok) throw new Error(added.message);
        toast.success(added.message ?? "Creator added to quotation.");
        onAdded({ itemIds: added.data?.itemIds });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add this creator. Please try again.");
      }
    });
  }

  return <div className="space-y-3">
    <div className="space-y-2">
      <Label htmlFor="quotation-creator-profile-link">Creator profile link</Label>
      <Input id="quotation-creator-profile-link" value={url} disabled={pending}
        placeholder="https://www.instagram.com/username/" autoComplete="off"
        aria-invalid={!!error} aria-describedby={error ? "quotation-creator-link-error" : "quotation-creator-link-help"}
        onChange={(event) => { setUrl(event.target.value); setError(null); }}
        onKeyDown={(event) => { if (event.key === "Enter" && url.trim()) { event.preventDefault(); addCreator(); } }} />
      <p id="quotation-creator-link-help" className="text-sm text-muted-foreground">
        Paste an Instagram, TikTok, YouTube, Facebook, Snapchat, or X profile link to add the creator directly to this quotation.
      </p>
    </div>
    {error && <p id="quotation-creator-link-error" role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" disabled={pending || !url.trim()} onClick={addCreator}>
      {pending ? "Adding creator…" : "Add creator from link"}
    </Button>
    {pending && <p role="status" className="text-sm text-muted-foreground">Finding the profile and adding it to your quotation…</p>}
  </div>;
}
