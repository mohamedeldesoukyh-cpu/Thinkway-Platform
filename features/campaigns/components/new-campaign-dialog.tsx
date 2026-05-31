"use client";

import { PlusIcon } from "lucide-react";
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
import {
  createCampaignAction,
  type CreateCampaignFormState,
} from "@/features/campaigns/actions";
import {
  CAMPAIGN_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import type { CampaignFormOptions } from "@/features/campaigns/queries";

const initialState: CreateCampaignFormState = { ok: false };

const NONE_VALUE = "__none__";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

type NewCampaignDialogProps = CampaignFormOptions;

export function NewCampaignDialog({
  clients,
  accountManagers,
}: NewCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("draft");
  const [currency, setCurrency] = useState("USD");
  const [accountManagerId, setAccountManagerId] = useState(NONE_VALUE);
  const [state, formAction, isPending] = useActionState(
    createCampaignAction,
    initialState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      setClientId("");
      setPlatform("");
      setStatus("draft");
      setCurrency("USD");
      setAccountManagerId(NONE_VALUE);
      setOpen(false);
      return;
    }

    toast.error(state.message);
  }, [state]);

  const hasClients = clients.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasClients}>
          <PlusIcon data-icon="inline-start" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Plan a client campaign. A campaign number is assigned automatically.
          </DialogDescription>
        </DialogHeader>
        {!hasClients ? (
          <p className="text-sm text-muted-foreground">
            Create a client first before adding campaigns.
          </p>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="currency" value={currency} />
            <input
              type="hidden"
              name="account_manager_id"
              value={accountManagerId === NONE_VALUE ? "" : accountManagerId}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="client_id_select">Client</Label>
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={isPending}
                  required
                >
                  <SelectTrigger id="client_id_select" className="w-full">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={state.fieldErrors?.client_id} />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Campaign name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Summer Glow Launch"
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.name} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="platform_select">Platform</Label>
                <Select
                  value={platform || NONE_VALUE}
                  onValueChange={(value) =>
                    setPlatform(value === NONE_VALUE ? "" : value)
                  }
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
                <FieldError messages={state.fieldErrors?.platform} />
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
                    {CAMPAIGN_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={state.fieldErrors?.status} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="budget">Budget</Label>
                <Input
                  id="budget"
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="50000"
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.budget} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="currency_select">Currency</Label>
                <Select
                  value={currency}
                  onValueChange={setCurrency}
                  disabled={isPending}
                >
                  <SelectTrigger id="currency_select" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={state.fieldErrors?.currency} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="start_date">Start date</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.start_date} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="end_date">End date</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.end_date} />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="account_manager_select">Account manager</Label>
                <Select
                  value={accountManagerId}
                  onValueChange={setAccountManagerId}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="account_manager_select"
                    className="w-full"
                  >
                    <SelectValue placeholder="Assign account manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
                    {accountManagers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name ?? manager.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={state.fieldErrors?.account_manager_id} />
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
              <Button type="submit" disabled={isPending || !clientId}>
                {isPending ? "Creating..." : "Create campaign"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
