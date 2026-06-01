"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ProfileUrlEnrichInput,
  type ProfileEnrichmentPayload,
} from "@/components/forms/profile-url-enrich-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  createVendorAction,
  type CreateVendorFormState,
} from "@/features/vendors/actions";
import {
  COUNTRY_OPTIONS,
  PRICING_CURRENCY_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";

const initialState: CreateVendorFormState = { ok: false };
const NONE_VALUE = "__none__";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function NewVendorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("prospect");
  const [countryCode, setCountryCode] = useState(NONE_VALUE);
  const [pricingCurrency, setPricingCurrency] = useState("USD");
  const [profileUrl, setProfileUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [state, formAction, isPending] = useActionState(
    createVendorAction,
    initialState
  );

  const resetForm = useCallback(() => {
    setStatus("prospect");
    setCountryCode(NONE_VALUE);
    setPricingCurrency("USD");
    setProfileUrl("");
    setPlatform("");
    setHandle("");
    setFollowerCount("");
    setDuplicateWarning("");
  }, []);

  const handleEnriched = useCallback((payload: ProfileEnrichmentPayload) => {
    const { parsed, enrichment, duplicates } = payload;
    setPlatform(parsed.platform);
    setHandle(parsed.username);
    setProfileUrl(parsed.profile_url);
    setDuplicateWarning(
      duplicates.length > 0
        ? `This account is already linked to ${duplicates[0].influencer_name}. You can still create the vendor.`
        : ""
    );

    if (
      enrichment?.follower_count != null &&
      !followerCount.trim()
    ) {
      setFollowerCount(String(enrichment.follower_count));
    }
  }, [followerCount]);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      resetForm();
      setOpen(false);

      if (state.vendorId) {
        router.push(`/vendors/${state.vendorId}`);
      }

      return;
    }

    toast.error(state.message);
  }, [router, state, resetForm]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Vendor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,840px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
          <DialogDescription>
            Add a creator or agency. Paste a profile URL to auto-fill platform
            details, or enter them manually.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="status" value={status} />
          <input
            type="hidden"
            name="country_code"
            value={countryCode === NONE_VALUE ? "" : countryCode}
          />
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="profile_url" value={profileUrl} />
          <input
            type="hidden"
            name="follower_count"
            value={followerCount || "0"}
          />
          <input type="hidden" name="pricing_currency" value={pricingCurrency} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="display_name">Creator name</Label>
              <Input
                id="display_name"
                name="display_name"
                placeholder="Jane Cooper"
                required
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.display_name} />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <ProfileUrlEnrichInput
                id="profile_url"
                label="Profile URL"
                value={profileUrl}
                disabled={isPending}
                onValueChange={(value) => {
                  setProfileUrl(value);
                  setDuplicateWarning("");
                }}
                onEnriched={handleEnriched}
              />
              {duplicateWarning ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {duplicateWarning}
                </p>
              ) : null}
              <FieldError messages={state.fieldErrors?.profile_url} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="legal_name">Agency name</Label>
              <Input
                id="legal_name"
                name="legal_name"
                placeholder="Creator Studio LLC"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.legal_name} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status_select">Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={isPending}
              >
                <SelectTrigger id="status_select" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="creator@example.com"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.email} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 555 0100"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.phone} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="country_select">Country</Label>
              <Select
                value={countryCode}
                onValueChange={setCountryCode}
                disabled={isPending}
              >
                <SelectTrigger id="country_select" className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                  {COUNTRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={state.fieldErrors?.country_code} />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="categories">Category / niche</Label>
              <Input
                id="categories"
                name="categories"
                placeholder="Beauty, Lifestyle, Skincare"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.categories} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="handle_display">Username (override)</Label>
              <Input
                id="handle_display"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
                placeholder="janecooper"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.handle} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="follower_count_display">Followers (override)</Label>
              <Input
                id="follower_count_display"
                type="number"
                min="0"
                step="1"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                placeholder="250000"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.follower_count} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pricing_amount">Base pricing</Label>
              <Input
                id="pricing_amount"
                name="pricing_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="5000"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.pricing_amount} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pricing_currency_select">Pricing currency</Label>
              <Select
                value={pricingCurrency}
                onValueChange={setPricingCurrency}
                disabled={isPending}
              >
                <SelectTrigger id="pricing_currency_select" className="w-full">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Internal notes about this vendor"
                rows={3}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.notes} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
