"use client";

import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import { ArchiveIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { labelForOption } from "@/features/clients/constants";
import {
  archiveLegalEntityAction,
  type FormActionState,
} from "@/features/groups/actions";
import {
  LegalEntitySheet,
  paymentTermsLabel,
} from "@/features/groups/components/legal-entity-sheet";
import type { GroupLegalEntityRow, GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney } from "@/features/groups/utils";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

type GroupLegalEntitiesTabProps = {
  workspace: GroupWorkspace;
  masterData: MasterDataOptions;
};

export function GroupLegalEntitiesTab({ workspace, masterData }: GroupLegalEntitiesTabProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupLegalEntityRow | null>(null);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(entity: GroupLegalEntityRow) {
    setEditing(entity);
    setSheetOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Legal entities</CardTitle>
            <p className="text-sm text-muted-foreground">
              Contracting parties linked to this group.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Add legal entity
          </Button>
        </CardHeader>
        <CardContent>
          {workspace.legal_entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No legal entities yet. Create one to start adding brands and campaigns.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Payment terms</TableHead>
                    <TableHead className="text-right">Active campaigns</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.legal_entities.map((entity) => (
                    <LegalEntityRow
                      key={entity.id}
                      groupId={workspace.id}
                      entity={entity}
                      onEdit={() => openEdit(entity)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LegalEntitySheet
        groupId={workspace.id}
        entity={editing}
        currencyOptions={currencyOptions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

function LegalEntityRow({
  groupId,
  entity,
  onEdit,
}: {
  groupId: string;
  entity: GroupLegalEntityRow;
  onEdit: () => void;
}) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveLegalEntityAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!archiveState.message) {
      return;
    }
    if (archiveState.ok) {
      toast.success(archiveState.message);
      return;
    }
    toast.error(archiveState.message);
  }, [archiveState]);

  const countryLabel = entity.country
    ? labelForOption(COUNTRY_OPTIONS, entity.country)
    : "—";

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-0.5">
          <Link
            href={`/clients/${entity.id}`}
            className="font-medium hover:underline"
          >
            {entity.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            <DocumentNumber value={entity.document_number} />
          </p>
        </div>
      </TableCell>
      <TableCell>{countryLabel}</TableCell>
      <TableCell>{entity.currency}</TableCell>
      <TableCell>{paymentTermsLabel(entity.payment_terms)}</TableCell>
      <TableCell className="text-right">{entity.active_campaigns}</TableCell>
      <TableCell className="text-right">
        {formatGroupMoney(entity.revenue)}
      </TableCell>
      <TableCell>
        <ClientStatusBadge status={entity.status} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <PencilIcon className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
          {entity.status !== "archived" ? (
            <form action={archiveAction}>
              <input type="hidden" name="client_id" value={entity.id} />
              <input type="hidden" name="group_id" value={groupId} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={archivePending}
              >
                <ArchiveIcon className="size-4" />
                <span className="sr-only">Archive</span>
              </Button>
            </form>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
