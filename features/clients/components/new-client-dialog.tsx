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
import { Textarea } from "@/components/ui/textarea";
import {
  createClientAction,
  type CreateClientFormState,
} from "@/features/clients/actions";
import {
  CLIENT_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/features/clients/constants";

const initialState: CreateClientFormState = { ok: false };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function NewClientDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("prospect");
  const [currency, setCurrency] = useState("USD");
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    initialState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      setStatus("prospect");
      setCurrency("USD");
      setOpen(false);
      return;
    }

    toast.error(state.message);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Add a client record. A client number is assigned automatically.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="currency" value={currency} />
          <div className="grid gap-2">
            <Label htmlFor="name">Client name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Acme Beauty Co."
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input
              id="legal_name"
              name="legal_name"
              placeholder="Acme Beauty Co. Ltd."
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.legal_name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="Beauty & Cosmetics"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.industry} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://example.com"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.website} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={isPending}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={state.fieldErrors?.status} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={isPending}
              >
                <SelectTrigger id="currency" className="w-full">
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="billing_email">Billing email</Label>
            <Input
              id="billing_email"
              name="billing_email"
              type="email"
              placeholder="billing@example.com"
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.billing_email} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Internal notes about this client"
              rows={3}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.notes} />
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
              {isPending ? "Creating..." : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
