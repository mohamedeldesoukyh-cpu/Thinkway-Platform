"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

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
  updateVendorLegalAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
} from "@/features/vendors/constants";
import type {
  ContractStatus,
  ExclusivityType,
  VendorDetail,
} from "@/types/database";

export function VendorLegalTab({ vendor }: { vendor: VendorDetail }) {
  const [contractStatus, setContractStatus] = useState(
    vendor.contract_status ?? "none"
  );
  const [exclusivity, setExclusivity] = useState(vendor.exclusivity ?? "none");

  const [state, formAction, isPending] = useActionState(
    updateVendorLegalAction,
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
        <CardTitle>Legal & contract</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="contract_status" value={contractStatus} />
          <input type="hidden" name="exclusivity" value={exclusivity} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Contract status</Label>
              <Select
                value={contractStatus}
                onValueChange={(v) => setContractStatus(v as ContractStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contract_expiry">Contract expiry</Label>
              <Input
                id="contract_expiry"
                name="contract_expiry"
                type="date"
                defaultValue={vendor.contract_expiry ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Exclusivity</Label>
              <Select
                value={exclusivity}
                onValueChange={(v) => setExclusivity(v as ExclusivityType)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXCLUSIVITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save legal"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
