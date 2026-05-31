"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

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
  PLATFORM_OPTIONS,
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
  const [platform, setPlatform] = useState(NONE_VALUE);
  const [pricingCurrency, setPricingCurrency] = useState("USD");
  const [state, formAction, isPending] = useActionState(
    createVendorAction,
    initialState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      setStatus("prospect");
      setCountryCode(NONE_VALUE);
      setPlatform(NONE_VALUE);
      setPricingCurrency("USD");
      setOpen(false);

      if (state.vendorId) {
        router.push(`/vendors/${state.vendorId}`);
      }

      return;
    }

    toast.error(state.message);
  }, [router, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Add a creator or agency. A vendor number is assigned automatically.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="status" value={status} />
          <input
            type="hidden"
            name="country_code"
            value={countryCode === NONE_VALUE ? "" : countryCode}
          />
          <input
            type="hidden"
            name="platform"
            value={platform === NONE_VALUE ? "" : platform}
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
              <Label htmlFor="platform_select">Primary platform</Label>
              <Select
                value={platform}
                onValueChange={setPlatform}
                disabled={isPending}
              >
                <SelectTrigger id="platform_select" className="w-full">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                  {PLATFORM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                name="handle"
                placeholder="@janecooper"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.handle} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="follower_count">Followers</Label>
              <Input
                id="follower_count"
                name="follower_count"
                type="number"
                min="0"
                step="1"
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
