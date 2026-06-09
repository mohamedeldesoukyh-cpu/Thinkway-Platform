"use client";



import { useActionState, useEffect, useMemo } from "react";

import { toast } from "sonner";



import {

  OperationalConfigurableTable,

  type OperationalConfigurableColumnDef,

  getOperationalTableColumnMetas,

} from "@/components/tables/operational-configurable-table";

import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CLIENT_ACCESS_USERS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { DocumentNumber } from "@/components/ui/document-number";

import {

  removeClientUserAction,

  setPrimaryClientUserAction,

} from "@/features/client-access/actions";

import { AssignClientUserSheet } from "@/features/client-access/components/assign-client-user-sheet";

import { ClientAccessRoleSelect } from "@/features/client-access/components/client-access-role-select";

import type {

  AssignableClientProfileRow,

  ClientAccessEntityRow,

} from "@/features/client-access/types";

import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";



const INITIAL = { ok: false } as const;



type ClientAccessUserRow = ClientAccessEntityRow["users"][number];



function buildClientAccessColumns({

  clientId,

  removeAction,

  removePending,

  primaryAction,

  primaryPending,

}: {

  clientId: string;

  removeAction: (payload: FormData) => void;

  removePending: boolean;

  primaryAction: (payload: FormData) => void;

  primaryPending: boolean;

}): OperationalConfigurableColumnDef<ClientAccessUserRow>[] {

  return [

    {

      id: "user",

      label: "User",

      cellClassName: "font-medium",

      renderCell: (user) => user.full_name ?? "—",

    },

    {

      id: "email",

      label: "Email",

      renderCell: (user) => user.email,

    },

    {

      id: "role",

      label: "Role",

      renderCell: (user) => (

        <ClientAccessRoleSelect

          clientId={clientId}

          profileId={user.profile_id}

          currentRole={user.access_role}

        />

      ),

    },

    {

      id: "primary",

      label: "Primary",

      renderCell: (user) =>

        user.is_primary ? (

          <Badge variant="secondary">Primary</Badge>

        ) : (

          <form action={primaryAction}>

            <input type="hidden" name="client_id" value={clientId} />

            <input type="hidden" name="profile_id" value={user.profile_id} />

            <Button type="submit" variant="ghost" size="sm" disabled={primaryPending}>

              Set primary

            </Button>

          </form>

        ),

    },

    {

      id: "actions",

      label: "Actions",

      locked: true,

      headerClassName: "text-right",

      cellClassName: "text-right",

      renderCell: (user) => (

        <form action={removeAction}>

          <input type="hidden" name="client_id" value={clientId} />

          <input type="hidden" name="profile_id" value={user.profile_id} />

          <Button type="submit" variant="outline" size="sm" disabled={removePending}>

            Remove

          </Button>

        </form>

      ),

    },

  ];

}



export const CLIENT_ACCESS_USERS_COLUMN_METAS = getOperationalTableColumnMetas(

  buildClientAccessColumns({

    clientId: "",

    removeAction: () => {},

    removePending: false,

    primaryAction: () => {},

    primaryPending: false,

  })

);



type Props = {

  entity: ClientAccessEntityRow;

  assignable: AssignableClientProfileRow[];

  compact?: boolean;

};



export function ClientAccessWorkspace({ entity, assignable, compact }: Props) {

  const [removeState, removeAction, removePending] = useActionState(

    removeClientUserAction,

    INITIAL

  );

  const [primaryState, primaryAction, primaryPending] = useActionState(

    setPrimaryClientUserAction,

    INITIAL

  );



  useEffect(() => {

    if (removeState.message) {

      if (removeState.ok) toast.success(removeState.message);

      else toast.error(removeState.message);

    }

  }, [removeState]);



  useEffect(() => {

    if (primaryState.message) {

      if (primaryState.ok) toast.success(primaryState.message);

      else toast.error(primaryState.message);

    }

  }, [primaryState]);



  const columns = useMemo(

    () =>

      buildClientAccessColumns({

        clientId: entity.client_id,

        removeAction,

        removePending,

        primaryAction,

        primaryPending,

      }),

    [entity.client_id, removeAction, removePending, primaryAction, primaryPending]

  );



  return (

    <OperationalTableSuiteProvider

      tableId={OPERATIONAL_TABLE_IDS.settingsClientAccessUsers}

      columns={columns}

      rows={entity.users}

      filterAccessors={CLIENT_ACCESS_USERS_FILTER_ACCESSORS}

    >

      <div className="space-y-4">

        {!compact ? (

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <h3 className="font-heading text-lg font-semibold">{entity.client_name}</h3>

              <p className="text-sm text-muted-foreground">

                <DocumentNumber value={entity.document_number} />

              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <OperationalTableControlsSlot contextLabel="Client access users" />

              <AssignClientUserSheet

                clientId={entity.client_id}

                clientName={entity.client_name}

                assignable={assignable}

              />

            </div>

          </div>

        ) : (

          <div className="flex flex-wrap items-center justify-end gap-2">

            <OperationalTableControlsSlot contextLabel="Client access users" />

            <AssignClientUserSheet

              clientId={entity.client_id}

              clientName={entity.client_name}

              assignable={assignable}

            />

          </div>

        )}



        {entity.users.length === 0 ? (

          <p className="px-4 py-8 text-[11px] text-muted-foreground">

            No client portal users assigned to this legal entity.

          </p>

        ) : (

          <OperationalConfigurableTable

            columns={columns}

            rows={entity.users}

            rowKey={(user) => user.profile_id}

          />

        )}

      </div>

    </OperationalTableSuiteProvider>

  );

}


