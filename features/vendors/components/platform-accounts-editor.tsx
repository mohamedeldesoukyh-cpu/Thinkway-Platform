"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { EnrichmentStatusBadge } from "@/components/forms/enrichment-status-badge";
import { FieldError } from "@/components/forms/field-error";
import { PlatformMetricsSection } from "@/components/forms/platform-metrics-section";
import {
  ProfileUrlEnrichInput,
  type ProfileEnrichmentPayload,
} from "@/components/forms/profile-url-enrich-input";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  savePlatformAccountsAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { COUNTRY_OPTIONS, PLATFORM_OPTIONS } from "@/features/vendors/constants";
import { applyProfileEnrichment } from "@/lib/social/apply-profile-enrichment";
import {
  metricValueToInput,
  type MetricsSource,
} from "@/lib/social/enrichment/metrics-status";
import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/platforms";
import type { InfluencerPlatformAccountRow, VendorDetail } from "@/types/database";

type EditableAccount = {
  key: string;
  id?: string;
  platform: string;
  username: string;
  profile_url: string;
  profile_display_name: string;
  profile_bio: string;
  profile_picture_url: string;
  follower_count: string;
  following_count: string;
  engagement_rate: string;
  avg_views: string;
  audience_country: string;
  audience_male_pct: string;
  audience_female_pct: string;
  is_verified: boolean;
  is_primary: boolean;
  sync_status: string;
  sync_source: string;
  sync_error: string;
  last_synced_at: string;
  metrics_source: MetricsSource;
  metrics_last_synced_at: string;
  metrics_is_manual_override: boolean;
  metric_field_sources: {
    followers: MetricsSource;
    engagement: MetricsSource;
    avg_views: MetricsSource;
  };
  duplicate_warning: string;
};

function readGenderSplit(
  split: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = split?.[key];
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

function resolveFieldSources(
  account: InfluencerPlatformAccountRow
): EditableAccount["metric_field_sources"] {
  const base = account.metrics_source ?? "unavailable";
  const manual = account.metrics_is_manual_override;

  return {
    followers:
      account.follower_count != null
        ? manual
          ? "manual"
          : "synced"
        : base,
    engagement:
      account.engagement_rate != null
        ? manual
          ? "manual"
          : "synced"
        : base,
    avg_views:
      account.avg_views != null ? (manual ? "manual" : "synced") : base,
  };
}

function toEditable(account: InfluencerPlatformAccountRow): EditableAccount {
  const split = account.audience_gender_split ?? {};
  const metricsSource = account.metrics_source ?? "unavailable";
  const manualOverride = account.metrics_is_manual_override ?? false;

  return {
    key: account.id,
    id: account.id,
    platform: account.platform,
    username: account.username ?? account.handle,
    profile_url: account.profile_url ?? "",
    profile_display_name: account.profile_display_name ?? "",
    profile_bio: account.profile_bio ?? "",
    profile_picture_url: account.profile_picture_url ?? "",
    follower_count: metricValueToInput(
      account.follower_count,
      metricsSource,
      manualOverride
    ),
    following_count: metricValueToInput(
      account.following_count,
      metricsSource,
      manualOverride
    ),
    engagement_rate:
      account.engagement_rate != null ? String(account.engagement_rate) : "",
    avg_views: metricValueToInput(account.avg_views, metricsSource, manualOverride),
    audience_country: account.audience_country ?? "",
    audience_male_pct: readGenderSplit(split, "male"),
    audience_female_pct: readGenderSplit(split, "female"),
    is_verified: account.is_verified,
    is_primary: account.is_primary,
    sync_status: account.sync_status ?? "manual",
    sync_source: account.sync_source ?? "",
    sync_error: account.sync_error ?? "",
    last_synced_at: account.last_synced_at ?? "",
    metrics_source: metricsSource,
    metrics_last_synced_at: account.metrics_last_synced_at ?? "",
    metrics_is_manual_override: manualOverride,
    metric_field_sources: resolveFieldSources(account),
    duplicate_warning: "",
  };
}

let newAccountCounter = 0;

function emptyAccount(): EditableAccount {
  newAccountCounter += 1;
  return {
    key: `new-${newAccountCounter}`,
    platform: "instagram",
    username: "",
    profile_url: "",
    profile_display_name: "",
    profile_bio: "",
    profile_picture_url: "",
    follower_count: "",
    following_count: "",
    engagement_rate: "",
    avg_views: "",
    audience_country: "",
    audience_male_pct: "",
    audience_female_pct: "",
    is_verified: false,
    is_primary: false,
    sync_status: "manual",
    sync_source: "",
    sync_error: "",
    last_synced_at: "",
    metrics_source: "unavailable",
    metrics_last_synced_at: "",
    metrics_is_manual_override: false,
    metric_field_sources: {
      followers: "unavailable",
      engagement: "unavailable",
      avg_views: "unavailable",
    },
    duplicate_warning: "",
  };
}

function markMetricManual(
  account: EditableAccount,
  field: keyof EditableAccount["metric_field_sources"],
  value: string
): EditableAccount {
  return {
    ...account,
    metrics_is_manual_override: true,
    metrics_source: "manual",
    metric_field_sources: {
      ...account.metric_field_sources,
      [field]: value.trim() ? "manual" : account.metric_field_sources[field],
    },
  };
}

type PlatformAccountsEditorProps = {
  vendor: VendorDetail;
};

export function PlatformAccountsEditor({ vendor }: PlatformAccountsEditorProps) {
  const initial = useMemo(
    () =>
      vendor.platform_accounts.length > 0
        ? vendor.platform_accounts.map(toEditable)
        : [emptyAccount()],
    [vendor.platform_accounts]
  );

  const [accounts, setAccounts] = useState<EditableAccount[]>(initial);

  const [state, formAction, isPending] = useActionState(
    savePlatformAccountsAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const handleEnriched = useCallback(
    (key: string) => (payload: ProfileEnrichmentPayload) => {
      setAccounts((prev) =>
        prev.map((row) =>
          row.key === key ? applyProfileEnrichment(row, payload) : row
        )
      );
    },
    []
  );

  const handleRefreshEnrichment = useCallback(
    (key: string) => (payload: ProfileEnrichmentPayload) => {
      setAccounts((prev) =>
        prev.map((row) =>
          row.key === key
            ? applyProfileEnrichment(row, payload, {
                preserveManualMetrics: row.metrics_is_manual_override,
              })
            : row
        )
      );
    },
    []
  );

  const accountsJson = JSON.stringify(
    accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      username: account.username,
      profile_url: account.profile_url,
      profile_display_name: account.profile_display_name,
      profile_bio: account.profile_bio,
      profile_picture_url: account.profile_picture_url,
      follower_count: account.follower_count,
      following_count: account.following_count,
      engagement_rate: account.engagement_rate,
      avg_views: account.avg_views,
      audience_country: account.audience_country,
      audience_male_pct: account.audience_male_pct,
      audience_female_pct: account.audience_female_pct,
      is_verified: account.is_verified,
      is_primary: account.is_primary,
      sync_status: account.sync_status,
      sync_source: account.sync_source,
      sync_error: account.sync_error,
      last_synced_at: account.last_synced_at,
      metrics_source: account.metrics_source,
      metrics_last_synced_at: account.metrics_last_synced_at,
      metrics_is_manual_override: account.metrics_is_manual_override,
    }))
  );

  return (
    <OperationalFormSection
      title="Platform accounts"
      description="Paste a profile URL to auto-detect platform and public stats. Empty metrics mean data was unavailable — not zero followers."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAccounts((prev) => [...prev, emptyAccount()])}
        >
          <PlusIcon data-icon="inline-start" />
          Add platform
        </Button>
      }
      footer={
        <Button type="submit" form="platform-accounts-form" disabled={isPending}>
          {isPending ? "Saving…" : "Save platforms"}
        </Button>
      }
    >
        <form id="platform-accounts-form" action={formAction} className="space-y-4">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="accounts_json" value={accountsJson} />

          {accounts.map((account, index) => (
            <div
              key={account.key}
              className="space-y-4 rounded-3xl border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Platform {index + 1}</p>
                  {account.platform ? (
                    <Badge variant="secondary">
                      {PLATFORM_LABELS[account.platform as SocialPlatform] ??
                        account.platform}
                    </Badge>
                  ) : null}
                  <EnrichmentStatusBadge status={account.sync_status} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={account.is_primary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAccounts((prev) =>
                          prev.map((row) => ({
                            ...row,
                            is_primary:
                              row.key === account.key
                                ? checked
                                : checked
                                  ? false
                                  : row.is_primary,
                          }))
                        );
                      }}
                    />
                    Primary
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={accounts.length <= 1}
                    onClick={() =>
                      setAccounts((prev) =>
                        prev.filter((row) => row.key !== account.key)
                      )
                    }
                  >
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">Remove platform</span>
                  </Button>
                </div>
              </div>

              {(account.profile_picture_url ||
                account.profile_display_name ||
                account.profile_bio) && (
                <div className="flex gap-3 rounded-2xl bg-muted/40 p-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {account.profile_picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.profile_picture_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {account.username.slice(0, 2).toUpperCase() || "CR"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {account.profile_display_name ? (
                      <p className="truncate text-sm font-medium">
                        {account.profile_display_name}
                        {account.is_verified ? (
                          <span className="ml-1 text-xs text-blue-500">✓</span>
                        ) : null}
                      </p>
                    ) : null}
                    {account.profile_bio ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {account.profile_bio}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <ProfileUrlEnrichInput
                id={`profile-url-${account.key}`}
                value={account.profile_url}
                platformHint={account.platform as SocialPlatform}
                influencerId={vendor.id}
                accountId={account.id}
                onValueChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? { ...row, profile_url: value, duplicate_warning: "" }
                        : row
                    )
                  )
                }
                onEnriched={handleEnriched(account.key)}
              />

              {account.duplicate_warning ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {account.duplicate_warning}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Platform</Label>
                  <Select
                    value={account.platform}
                    onValueChange={(value) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, platform: value }
                            : row
                        )
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input
                    value={account.username}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, username: e.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="@creator"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Display name</Label>
                  <Input
                    value={account.profile_display_name}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, profile_display_name: e.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="Public display name"
                  />
                </div>
              </div>

              <PlatformMetricsSection
                platform={account.platform}
                profileUrl={account.profile_url}
                influencerId={vendor.id}
                accountId={account.id}
                followerCount={account.follower_count}
                engagementRate={account.engagement_rate}
                avgViews={account.avg_views}
                metricsSource={account.metrics_source}
                metricsIsManualOverride={account.metrics_is_manual_override}
                metricFieldSources={account.metric_field_sources}
                fieldIdPrefix={account.key}
                onFollowersChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? {
                            ...markMetricManual(row, "followers", value),
                            follower_count: value,
                          }
                        : row
                    )
                  )
                }
                onEngagementChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? {
                            ...markMetricManual(row, "engagement", value),
                            engagement_rate: value,
                          }
                        : row
                    )
                  )
                }
                onAvgViewsChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? {
                            ...markMetricManual(row, "avg_views", value),
                            avg_views: value,
                          }
                        : row
                    )
                  )
                }
                onRefreshEnrichment={handleRefreshEnrichment(account.key)}
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Following</Label>
                  <Input
                    type="number"
                    min={0}
                    value={account.following_count}
                    placeholder="Not available"
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, following_count: e.target.value }
                            : row
                        )
                      )
                    }
                    className="border-dashed"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Audience country</Label>
                  <SearchableSelect
                    value={account.audience_country}
                    onValueChange={(value) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, audience_country: value }
                            : row
                        )
                      )
                    }
                    options={COUNTRY_OPTIONS}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Audience male %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={account.audience_male_pct}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, audience_male_pct: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Audience female %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={account.audience_female_pct}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? {
                                ...row,
                                audience_female_pct: e.target.value,
                              }
                            : row
                        )
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <FieldError messages={state.fieldErrors?.accounts_json} />

        </form>
    </OperationalFormSection>
  );
}
