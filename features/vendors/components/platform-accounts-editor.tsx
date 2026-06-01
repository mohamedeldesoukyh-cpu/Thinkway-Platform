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

import { FieldError } from "@/components/forms/field-error";
import {
  ProfileUrlEnrichInput,
  type ProfileEnrichmentPayload,
} from "@/components/forms/profile-url-enrich-input";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { InfluencerPlatformAccountRow, VendorDetail } from "@/types/database";
import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/platforms";

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

function formatSyncLabel(status: string): string {
  switch (status) {
    case "synced":
      return "Synced";
    case "partial":
      return "Partial sync";
    case "failed":
      return "Sync failed";
    case "pending":
      return "Syncing…";
    default:
      return "Manual entry";
  }
}

function toEditable(account: InfluencerPlatformAccountRow): EditableAccount {
  const split = account.audience_gender_split ?? {};
  return {
    key: account.id,
    id: account.id,
    platform: account.platform,
    username: account.username ?? account.handle,
    profile_url: account.profile_url ?? "",
    profile_display_name: account.profile_display_name ?? "",
    profile_bio: account.profile_bio ?? "",
    profile_picture_url: account.profile_picture_url ?? "",
    follower_count: String(account.follower_count ?? 0),
    following_count: String(account.following_count ?? 0),
    engagement_rate:
      account.engagement_rate != null ? String(account.engagement_rate) : "",
    avg_views: String(account.avg_views ?? 0),
    audience_country: account.audience_country ?? "",
    audience_male_pct: readGenderSplit(split, "male"),
    audience_female_pct: readGenderSplit(split, "female"),
    is_verified: account.is_verified,
    is_primary: account.is_primary,
    sync_status: account.sync_status ?? "manual",
    sync_source: account.sync_source ?? "",
    sync_error: account.sync_error ?? "",
    last_synced_at: account.last_synced_at ?? "",
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
    follower_count: "0",
    following_count: "0",
    engagement_rate: "",
    avg_views: "0",
    audience_country: "",
    audience_male_pct: "",
    audience_female_pct: "",
    is_verified: false,
    is_primary: false,
    sync_status: "manual",
    sync_source: "",
    sync_error: "",
    last_synced_at: "",
    duplicate_warning: "",
  };
}

function applyEnrichment(
  account: EditableAccount,
  payload: ProfileEnrichmentPayload
): EditableAccount {
  const { parsed, enrichment, duplicates } = payload;
  const next: EditableAccount = {
    ...account,
    platform: parsed.platform,
    username: parsed.username,
    profile_url: parsed.profile_url,
    duplicate_warning:
      duplicates.length > 0
        ? `Already linked to ${duplicates[0].influencer_name}`
        : "",
  };

  if (!enrichment) {
    next.sync_status = "partial";
    next.sync_source = "url_parse";
    next.last_synced_at = new Date().toISOString();
    return next;
  }

  if (enrichment.display_name && !account.profile_display_name.trim()) {
    next.profile_display_name = enrichment.display_name;
  }
  if (enrichment.bio && !account.profile_bio.trim()) {
    next.profile_bio = enrichment.bio;
  }
  if (enrichment.profile_picture_url && !account.profile_picture_url.trim()) {
    next.profile_picture_url = enrichment.profile_picture_url;
  }
  if (
    enrichment.follower_count != null &&
    (account.follower_count === "0" || !account.follower_count.trim())
  ) {
    next.follower_count = String(enrichment.follower_count);
  }
  if (
    enrichment.following_count != null &&
    (account.following_count === "0" || !account.following_count.trim())
  ) {
    next.following_count = String(enrichment.following_count);
  }
  if (
    enrichment.engagement_rate != null &&
    !account.engagement_rate.trim()
  ) {
    next.engagement_rate = String(enrichment.engagement_rate);
  }
  if (enrichment.is_verified != null) {
    next.is_verified = enrichment.is_verified;
  }
  if (enrichment.audience_country && !account.audience_country.trim()) {
    next.audience_country = enrichment.audience_country;
  }

  next.sync_status = enrichment.sync_status;
  next.sync_source = enrichment.sync_source;
  next.sync_error = enrichment.sync_error ?? "";
  next.last_synced_at = new Date().toISOString();

  return next;
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
          row.key === key ? applyEnrichment(row, payload) : row
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
    }))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Platform accounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste a profile URL to auto-detect platform, username, and public
            stats. All fields remain editable.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAccounts((prev) => [...prev, emptyAccount()])}
        >
          <PlusIcon data-icon="inline-start" />
          Add platform
        </Button>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="accounts_json" value={accountsJson} />

          {accounts.map((account, index) => (
            <div
              key={account.key}
              className="space-y-4 rounded-3xl border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Platform {index + 1}</p>
                  {account.platform ? (
                    <Badge variant="secondary">
                      {PLATFORM_LABELS[account.platform as SocialPlatform] ??
                        account.platform}
                    </Badge>
                  ) : null}
                  <Badge variant="outline">{formatSyncLabel(account.sync_status)}</Badge>
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Followers</Label>
                  <Input
                    type="number"
                    min={0}
                    value={account.follower_count}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, follower_count: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Following</Label>
                  <Input
                    type="number"
                    min={0}
                    value={account.following_count}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, following_count: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Engagement %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={account.engagement_rate}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, engagement_rate: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Avg views</Label>
                  <Input
                    type="number"
                    min={0}
                    value={account.avg_views}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, avg_views: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save platforms"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
