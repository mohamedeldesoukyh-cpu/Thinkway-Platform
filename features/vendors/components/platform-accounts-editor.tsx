"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
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

type EditableAccount = {
  key: string;
  id?: string;
  platform: string;
  username: string;
  profile_url: string;
  follower_count: string;
  engagement_rate: string;
  avg_views: string;
  audience_country: string;
  audience_male_pct: string;
  audience_female_pct: string;
  is_primary: boolean;
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

function toEditable(account: InfluencerPlatformAccountRow): EditableAccount {
  const split = account.audience_gender_split ?? {};
  return {
    key: account.id,
    id: account.id,
    platform: account.platform,
    username: account.username ?? account.handle,
    profile_url: account.profile_url ?? "",
    follower_count: String(account.follower_count ?? 0),
    engagement_rate:
      account.engagement_rate != null ? String(account.engagement_rate) : "",
    avg_views: String(account.avg_views ?? 0),
    audience_country: account.audience_country ?? "",
    audience_male_pct: readGenderSplit(split, "male"),
    audience_female_pct: readGenderSplit(split, "female"),
    is_primary: account.is_primary,
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
    follower_count: "0",
    engagement_rate: "",
    avg_views: "0",
    audience_country: "",
    audience_male_pct: "",
    audience_female_pct: "",
    is_primary: false,
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

  const accountsJson = JSON.stringify(
    accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      username: account.username,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
      avg_views: account.avg_views,
      audience_country: account.audience_country,
      audience_male_pct: account.audience_male_pct,
      audience_female_pct: account.audience_female_pct,
      is_primary: account.is_primary,
    }))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Platform accounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add multiple social profiles with stats per platform.
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
                <p className="text-sm font-medium">Platform {index + 1}</p>
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
                  <Label>Profile URL</Label>
                  <Input
                    value={account.profile_url}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, profile_url: e.target.value }
                            : row
                        )
                      )
                    }
                    type="url"
                    placeholder="https://"
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
