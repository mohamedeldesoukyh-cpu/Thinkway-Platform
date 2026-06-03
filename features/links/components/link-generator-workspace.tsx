"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function LinkGeneratorWorkspace() {
  const [channel, setChannel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [campaign, setCampaign] = useState("");
  const [vendor, setVendor] = useState("");
  const [uid, setUid] = useState("");

  const generatedLink = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://tw.link";
    const campaignSlug = slugify(campaign) || "campaign";
    const vendorSlug = slugify(vendor) || "vendor";
    const params = new URLSearchParams();
    if (uid.trim()) params.set("uid", uid.trim());
    if (targetUrl.trim()) params.set("target", targetUrl.trim());
    if (channel.trim()) params.set("channel", slugify(channel));
    params.set("ref", "thinkway");
    const query = params.toString();
    return `${base}/c/${campaignSlug}/${vendorSlug}${query ? `?${query}` : ""}`;
  }, [campaign, vendor, uid, targetUrl, channel]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Create a link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="channel">Choose channel</Label>
            <Input
              id="channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              placeholder="www.youtube.com/channel"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="target">Target URL</Label>
            <Input
              id="target"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://www.target-url.com"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Input
                id="campaign"
                value={campaign}
                onChange={(event) => setCampaign(event.target.value)}
                placeholder="TW-2026-0001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
                placeholder="Vendor name"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="uid">UID (optional)</Label>
            <Input
              id="uid"
              value={uid}
              onChange={(event) => setUid(event.target.value)}
              placeholder="Optional tracking UID"
            />
          </div>

          <div className="rounded-2xl border border-border bg-muted px-4 py-3 font-mono text-xs break-all text-muted-foreground">
            {generatedLink}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              Copy link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Links use your campaign and vendor identifiers for attribution.</p>
          <p>Add a UID to track a specific placement or creative.</p>
          <p>
            The <span className="font-mono">ref=thinkway</span> tag is appended
            automatically for source attribution.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
