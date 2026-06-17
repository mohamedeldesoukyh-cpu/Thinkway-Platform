"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
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
import { AGENCY_OR_DIRECT_OPTIONS, CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  createGroupAction,
  type CreateGroupFormState,
} from "@/features/groups/actions";
import { checkGroupNameAvailable } from "@/features/validation/actions";
import { cn } from "@/lib/utils";
import type { AgencyOrDirect, ClientStatus } from "@/types/database";

type ClientSetupMode = "none" | "link_existing" | "create_new";

type UnlinkedClientOption = {
  id: string;
  name: string;
  legal_name: string | null;
};

type NewClientDraft = {
  id: string;
  name: string;
  legal_name: string;
  agency_or_direct: AgencyOrDirect;
};

type NewGroupDialogProps = {
  unlinkedClients: UnlinkedClientOption[];
};

const CLIENT_SETUP_OPTIONS: { value: ClientSetupMode; label: string; description: string }[] =
  [
    {
      value: "none",
      label: "Skip for now",
      description: "Create the group only. Link or add clients later from the group workspace.",
    },
    {
      value: "link_existing",
      label: "Link existing clients",
      description: "Attach clients that are not yet assigned to a holding group.",
    },
    {
      value: "create_new",
      label: "Create new clients",
      description: "Add one or more client legal entities under this group.",
    },
  ];

function createEmptyClientDraft(): NewClientDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    legal_name: "",
    agency_or_direct: "agency",
  };
}

export function NewGroupDialog({ unlinkedClients }: NewGroupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientStatus>("active");
  const [groupName, setGroupName] = useState("");
  const [clientSetup, setClientSetup] = useState<ClientSetupMode>("none");
  const [linkedClientIds, setLinkedClientIds] = useState<string[]>([]);
  const [newClientDrafts, setNewClientDrafts] = useState<NewClientDraft[]>([
    createEmptyClientDraft(),
  ]);
  const [state, formAction, isPending] = useActionState(createGroupAction, {
    ok: false,
  } satisfies CreateGroupFormState);

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    groupName,
    checkGroupNameAvailable,
    [],
    open
  );

  const newClientsJson = useMemo(
    () =>
      JSON.stringify(
        newClientDrafts.map(({ name, legal_name, agency_or_direct }) => ({
          name,
          legal_name,
          agency_or_direct,
        }))
      ),
    [newClientDrafts]
  );

  function resetForm() {
    setGroupName("");
    setStatus("active");
    setClientSetup("none");
    setLinkedClientIds([]);
    setNewClientDrafts([createEmptyClientDraft()]);
  }

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      resetForm();
      if (state.groupId) {
        router.push(`/groups/${state.groupId}`);
      }
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  function toggleLinkedClient(clientId: string) {
    setLinkedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]
    );
  }

  function updateClientDraft(id: string, patch: Partial<NewClientDraft>) {
    setNewClientDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
    );
  }

  function removeClientDraft(id: string) {
    setNewClientDrafts((current) =>
      current.length <= 1 ? current : current.filter((draft) => draft.id !== id)
    );
  }

  const linkSubmitDisabled =
    clientSetup === "link_existing" &&
    (linkedClientIds.length === 0 || unlinkedClients.length === 0);

  const createSubmitDisabled =
    clientSetup === "create_new" &&
    newClientDrafts.every((draft) => !draft.name.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-4">
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Top-level holding group. Optionally link existing clients or create new ones
            under the group.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="client_setup" value={clientSetup} />
          <input type="hidden" name="new_clients_json" value={newClientsJson} />
          {linkedClientIds.map((clientId) => (
            <input key={clientId} type="hidden" name="linked_client_ids" value={clientId} />
          ))}

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Group name</Label>
              <Input
                id="name"
                name="name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.name} />
              {duplicateMessage ? (
                <p className="text-xs text-destructive">{duplicateMessage}</p>
              ) : checking ? (
                <p className="text-xs text-muted-foreground">Checking availability…</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ClientStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} disabled={isPending} />
            </div>

            <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/10 p-3">
              <div className="space-y-1">
                <Label>Clients (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Choose how to handle clients for this group. You can always add more
                  later from the group workspace.
                </p>
              </div>

              <div className="grid gap-2">
                {CLIENT_SETUP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isPending}
                    onClick={() => setClientSetup(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      clientSetup === option.value
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 bg-background hover:bg-muted/30"
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>

              {clientSetup === "link_existing" ? (
                <div className="grid gap-2">
                  {unlinkedClients.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No unlinked clients available. Create clients from the Clients page
                      first, or choose &quot;Create new clients&quot; below.
                    </p>
                  ) : (
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-background p-2">
                      {unlinkedClients.map((client) => {
                        const checked = linkedClientIds.includes(client.id);
                        const label = client.legal_name
                          ? `${client.name} (${client.legal_name})`
                          : client.name;
                        return (
                          <label
                            key={client.id}
                            className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              disabled={isPending}
                              onChange={() => toggleLinkedClient(client.id)}
                            />
                            <span className="text-sm text-foreground">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <FieldError messages={state.fieldErrors?.linked_client_ids} />
                </div>
              ) : null}

              {clientSetup === "create_new" ? (
                <div className="grid gap-3">
                  {newClientDrafts.map((draft, index) => (
                    <div
                      key={draft.id}
                      className="space-y-3 rounded-lg border border-border/60 bg-background p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Client {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeClientDraft(draft.id)}
                          disabled={isPending || newClientDrafts.length <= 1}
                          aria-label={`Remove client ${index + 1}`}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`new-client-name-${draft.id}`}>Client name</Label>
                        <Input
                          id={`new-client-name-${draft.id}`}
                          value={draft.name}
                          onChange={(e) =>
                            updateClientDraft(draft.id, { name: e.target.value })
                          }
                          disabled={isPending}
                          placeholder="Legal entity name"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`new-client-legal-${draft.id}`}>Legal name</Label>
                        <Input
                          id={`new-client-legal-${draft.id}`}
                          value={draft.legal_name}
                          onChange={(e) =>
                            updateClientDraft(draft.id, { legal_name: e.target.value })
                          }
                          disabled={isPending}
                          placeholder="Optional"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Relationship type</Label>
                        <Select
                          value={draft.agency_or_direct}
                          onValueChange={(value) =>
                            updateClientDraft(draft.id, {
                              agency_or_direct: value as AgencyOrDirect,
                            })
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AGENCY_OR_DIRECT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={() =>
                      setNewClientDrafts((current) => [...current, createEmptyClientDraft()])
                    }
                    disabled={isPending}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add another client
                  </Button>
                  <FieldError messages={state.fieldErrors?.new_clients_json} />
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4">
            <Button
              type="submit"
              disabled={
                isPending ||
                isDuplicate ||
                checking ||
                linkSubmitDisabled ||
                createSubmitDisabled
              }
            >
              {isPending ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
