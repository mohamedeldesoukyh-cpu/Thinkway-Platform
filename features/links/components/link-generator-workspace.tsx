"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FinanceSuiteCard, FinanceSuiteEmpty } from "@/components/finance/suite";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHANNELS = ["Instagram", "TikTok", "YouTube", "Snapchat", "X", "Other"] as const;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function LinkGeneratorWorkspace() {
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const [channelCustom, setChannelCustom] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [campaign, setCampaign] = useState("");
  const [vendor, setVendor] = useState("");
  const [uid, setUid] = useState("");

  const channelValue = channel === "Other" ? channelCustom : channel;

  const generatedLink = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://tw.link";
    const campaignSlug = slugify(campaign) || "campaign";
    const vendorSlug = slugify(vendor) || "vendor";
    const params = new URLSearchParams();
    if (uid.trim()) params.set("uid", uid.trim());
    if (targetUrl.trim()) params.set("target", targetUrl.trim());
    if (channelValue.trim()) params.set("channel", slugify(channelValue));
    params.set("ref", "thinkway");
    const query = params.toString();
    return `${base}/c/${campaignSlug}/${vendorSlug}${query ? `?${query}` : ""}`;
  }, [campaign, vendor, uid, targetUrl, channelValue]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  return (
    <div>
      <FinanceSuiteCard
        title="Create a link"
        subtitle="campaign and vendor identifiers drive attribution"
      >
        <div className="tw-pad space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="grid gap-2">
              <Label htmlFor="channel">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {channel === "Other" ? (
              <div className="grid gap-2">
                <Label htmlFor="channel-custom">Custom channel</Label>
                <Input
                  id="channel-custom"
                  value={channelCustom}
                  onChange={(event) => setChannelCustom(event.target.value)}
                  placeholder="www.youtube.com/channel"
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Input
                id="campaign"
                value={campaign}
                onChange={(event) => setCampaign(event.target.value)}
                placeholder="TW-2026-1"
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
            <div className="grid gap-2">
              <Label htmlFor="uid">UID (optional)</Label>
              <Input
                id="uid"
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                placeholder="story-01"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2 xl:col-span-2">
              <Label htmlFor="target">Target URL</Label>
              <Input
                id="target"
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                placeholder="https://client.com/landing"
              />
            </div>
          </div>

          <div className="fs-link-preview">
            <code>{generatedLink}</code>
            <button type="button" className="tw-b sm" onClick={copyLink}>
              Copy link
            </button>
            <button type="button" className="tw-b sm pri">
              Create link
            </button>
          </div>
          <p className="tw-note" style={{ margin: "13px 0 0" }}>
            The <code className="font-mono">ref=thinkway</code> tag is appended automatically for
            source attribution. Adding a UID tracks a specific placement or creative.
          </p>
        </div>
      </FinanceSuiteCard>

      <FinanceSuiteCard
        title="Generated links"
        subtitle="every link created, with click attribution"
        actions={
          <>
            <button type="button" className="tw-b sm">
              Filter
            </button>
            <button type="button" className="tw-b sm">
              Sort
            </button>
            <button type="button" className="tw-b sm">
              Settings
            </button>
          </>
        }
      >
        <FinanceSuiteEmpty
          title="No stored link register yet"
          body="Copy the generated URL above. A persistent click register is not wired on this screen — the builder still creates the campaign/vendor attribution link."
        />
      </FinanceSuiteCard>
    </div>
  );
}
