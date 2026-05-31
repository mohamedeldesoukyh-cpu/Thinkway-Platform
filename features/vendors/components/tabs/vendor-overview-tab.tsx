"use client";

import { useActionState, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  updateVendorOverviewAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";
import type { InfluencerStatus, VendorDetail } from "@/types/database";

export function VendorOverviewTab({ vendor }: { vendor: VendorDetail }) {
  const [status, setStatus] = useState(vendor.status);
  const [country, setCountry] = useState(vendor.country_code ?? "");
  const [nationality, setNationality] = useState(vendor.nationality ?? "");
  const [gender, setGender] = useState(vendor.gender ?? "");

  const [state, formAction, isPending] = useActionState(
    updateVendorOverviewAction,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="country_code" value={country} />
          <input type="hidden" name="nationality" value={nationality} />
          <input type="hidden" name="gender" value={gender} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="display_name">Creator name</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={vendor.display_name}
                required
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.display_name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="legal_name">Management agency</Label>
              <Input
                id="legal_name"
                name="legal_name"
                defaultValue={vendor.legal_name ?? ""}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as InfluencerStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Gender</Label>
              <Select
                value={gender}
                onValueChange={setGender}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                defaultValue={vendor.city ?? ""}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Country</Label>
              <SearchableSelect
                value={country}
                onValueChange={setCountry}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Nationality</Label>
              <SearchableSelect
                value={nationality}
                onValueChange={setNationality}
                options={NATIONALITY_OPTIONS}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={vendor.email ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={vendor.phone ?? ""}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="influencer_url">Portfolio / URL</Label>
            <Input
              id="influencer_url"
              name="influencer_url"
              type="url"
              defaultValue={vendor.influencer_url ?? ""}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.influencer_url} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="management_agency">Agency contact name</Label>
            <Input
              id="management_agency"
              name="management_agency"
              defaultValue={vendor.management_agency ?? ""}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="categories">Categories / niche</Label>
              <Input
                id="categories"
                name="categories"
                defaultValue={vendor.categories?.join(", ") ?? ""}
                placeholder="beauty, lifestyle"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="languages">Languages</Label>
              <Input
                id="languages"
                name="languages"
                defaultValue={vendor.languages?.join(", ") ?? ""}
                placeholder="en, ar"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated language codes (e.g. en, ar)
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={vendor.notes ?? ""}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save overview"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
