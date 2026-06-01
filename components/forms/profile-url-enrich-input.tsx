"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EnrichmentResult } from "@/lib/social/enrichment/types";
import type { ParsedProfile } from "@/lib/social/parse-profile-url";
import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export type ProfileEnrichmentPayload = {
  parsed: ParsedProfile;
  enrichment: EnrichmentResult | null;
  duplicates: {
    account_id: string;
    influencer_id: string;
    influencer_name: string;
    influencer_document_number: string;
    platform: string;
    username: string;
    profile_url: string | null;
  }[];
};

type ProfileUrlEnrichInputProps = {
  id?: string;
  label?: string;
  value: string;
  platformHint?: SocialPlatform;
  influencerId?: string;
  accountId?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onEnriched: (payload: ProfileEnrichmentPayload) => void;
  className?: string;
};

export function ProfileUrlEnrichInput({
  id,
  label = "Profile URL",
  value,
  platformHint,
  influencerId,
  accountId,
  disabled,
  onValueChange,
  onEnriched,
  className,
}: ProfileUrlEnrichInputProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "warning"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<SocialPlatform | null>(
    null
  );
  const lastRequested = useRef<string>("");

  const onEnrichedRef = useRef(onEnriched);
  onEnrichedRef.current = onEnriched;

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 8) {
      setStatus("idle");
      setMessage(null);
      setDetectedPlatform(null);
      return;
    }

    if (trimmed === lastRequested.current) return;

    const timer = window.setTimeout(async () => {
      lastRequested.current = trimmed;
      setStatus("loading");
      setMessage("Detecting platform and syncing public profile…");

      try {
        const response = await fetch("/api/vendors/platform-accounts/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile_url: trimmed,
            platform: platformHint,
            influencer_id: influencerId,
            account_id: accountId,
          }),
        });

        const data = (await response.json()) as ProfileEnrichmentPayload & {
          error?: string;
        };

        if (!response.ok || !data.parsed) {
          setStatus("error");
          setMessage(data.error ?? "Could not parse this profile URL.");
          setDetectedPlatform(null);
          return;
        }

        setDetectedPlatform(data.parsed.platform);
        onEnrichedRef.current(data);

        if (data.duplicates.length > 0) {
          setStatus("warning");
          setMessage(
            `This ${PLATFORM_LABELS[data.parsed.platform]} account already exists on ${data.duplicates[0].influencer_name}.`
          );
          return;
        }

        const enrichmentMessages = data.enrichment?.messages ?? [];
        setStatus("success");
        setMessage(
          enrichmentMessages.length > 0
            ? enrichmentMessages.join(" · ")
            : `${PLATFORM_LABELS[data.parsed.platform]} profile detected`
        );
      } catch {
        setStatus("error");
        setMessage("Enrichment failed — you can still enter details manually.");
        setDetectedPlatform(null);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [value, platformHint, influencerId, accountId]);

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {detectedPlatform ? (
          <Badge variant="secondary">
            {PLATFORM_LABELS[detectedPlatform]}
          </Badge>
        ) : null}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          lastRequested.current = "";
          onValueChange(e.target.value);
        }}
        type="url"
        placeholder="https://instagram.com/username"
        disabled={disabled}
      />
      {status !== "idle" && message ? (
        <p
          className={cn(
            "flex items-start gap-2 text-xs",
            status === "error" && "text-destructive",
            status === "warning" && "text-amber-600 dark:text-amber-400",
            status === "success" && "text-emerald-600 dark:text-emerald-400",
            status === "loading" && "text-muted-foreground"
          )}
        >
          {status === "loading" ? (
            <Loader2Icon className="mt-0.5 size-3.5 shrink-0 animate-spin" />
          ) : status === "success" ? (
            <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
