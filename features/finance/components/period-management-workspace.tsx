"use client";



import { useActionState, useEffect, useMemo, useState } from "react";

import { format } from "date-fns";

import { LockIcon, UnlockIcon } from "lucide-react";

import { toast } from "sonner";



import {

  OperationalConfigurableTable,

  type OperationalConfigurableColumnDef,

  getOperationalTableColumnMetas,

} from "@/components/tables/operational-configurable-table";

import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";

import { DETAIL_FORM_SELECT_TRIGGER_CLASS } from "@/features/campaigns/components/operational-detail-panel";

import { OperationalTableSection } from "@/components/ui/operational-table-section";

import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogFooter,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";

import { updateFinancialPeriodAction } from "@/features/finance/actions";

import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";



type PeriodRow = {

  id: string;

  year: number;

  month: number;

  status: string;

  locked_at: string | null;

  notes: string | null;

  locked_by_name: string | null;

};



const STATUS_LABELS: Record<string, string> = {

  open: "Open",

  soft_locked: "Soft locked",

  fully_locked: "Fully locked",

};



const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {

  open: "outline",

  soft_locked: "secondary",

  fully_locked: "destructive",

};



function buildPeriodColumns(

  onLockClick: (period: PeriodRow) => void

): OperationalConfigurableColumnDef<PeriodRow>[] {

  return [

    {

      id: "period",

      label: "Period",

      cellClassName: "font-medium tabular-nums",

      renderCell: (period) =>

        `${period.year}-${String(period.month).padStart(2, "0")}`,

    },

    {

      id: "status",

      label: "Status",

      renderCell: (period) => (

        <Badge variant={STATUS_VARIANT[period.status] ?? "outline"}>

          {STATUS_LABELS[period.status] ?? period.status}

        </Badge>

      ),

    },

    {

      id: "locked_by",

      label: "Locked by",

      renderCell: (period) => period.locked_by_name ?? "—",

    },

    {

      id: "locked_at",

      label: "Locked at",

      renderCell: (period) =>

        period.locked_at

          ? format(new Date(period.locked_at), "MMM d, yyyy")

          : "—",

    },

    {

      id: "notes",

      label: "Notes",

      cellClassName: "max-w-[200px] truncate",

      renderCell: (period) => period.notes ?? "—",

    },

    {

      id: "actions",

      label: "Actions",

      locked: true,

      headerClassName: "text-right",

      cellClassName: "text-right",

      renderCell: (period) => (

        <Button

          size="sm"

          variant="outline"

          onClick={() => onLockClick(period)}

        >

          {period.status === "open" ? (

            <>

              <LockIcon className="size-4" />

              Lock

            </>

          ) : (

            <>

              <UnlockIcon className="size-4" />

              Unlock

            </>

          )}

        </Button>

      ),

    },

  ];

}



export const FINANCE_PERIOD_LOCKS_COLUMN_METAS = getOperationalTableColumnMetas(

  buildPeriodColumns(() => {})

);



type PeriodManagementWorkspaceProps = {

  periods: PeriodRow[];

};



export function PeriodManagementWorkspace({ periods }: PeriodManagementWorkspaceProps) {

  const [lockTarget, setLockTarget] = useState<PeriodRow | null>(null);

  const [newStatus, setNewStatus] = useState("soft_locked");

  const [reason, setReason] = useState("");



  const [state, formAction, pending] = useActionState(updateFinancialPeriodAction, {

    ok: false,

  });



  useEffect(() => {

    if (!state.message) return;

    if (state.ok) {

      toast.success(state.message);

      setLockTarget(null);

      setReason("");

    } else {

      toast.error(state.message);

    }

  }, [state]);



  const columns = useMemo(

    () =>

      buildPeriodColumns((period) => {

        setLockTarget(period);

        setNewStatus(period.status === "open" ? "soft_locked" : "open");

      }),

    []

  );



  const now = new Date();

  const currentYear = now.getFullYear();

  const currentMonth = now.getMonth() + 1;



  return (

    <div className="space-y-6">

      <OperationalTableSuiteProvider

        tableId={OPERATIONAL_TABLE_IDS.financePeriodLocks}

        columns={columns}

        rows={periods}

        filterAccessors={{

          period: (row) => `${row.year}-${row.month}`,

          status: (row) => row.status,

          locked_by: (row) => row.locked_by_name,

          locked_at: (row) => row.locked_at,

          notes: (row) => row.notes,

        }}

      >

        <OperationalTableSection

          wide

          tableOnly

          cardSurface

          leading={

            <CampaignOperationalSectionHeader

              title="Financial period management"

              description="Soft lock blocks operational edits; finance can still edit. Full lock requires override access."

              actions={<OperationalTableControlsSlot contextLabel="Period locks" />}

            />

          }

        >

          {periods.length === 0 ? (

            <p className="px-4 py-8 text-[11px] text-muted-foreground">

              No periods configured. Lock a month to begin governance.

            </p>

          ) : (

            <OperationalConfigurableTable

              columns={columns}

              rows={periods}

              rowKey={(period) => period.id}

            />

          )}

        </OperationalTableSection>

      </OperationalTableSuiteProvider>



      <OperationalFormSection

        title="Lock current month"

        footer={

          <Button type="submit" form="period-lock-form" disabled={pending}>

            Apply to {currentYear}-{String(currentMonth).padStart(2, "0")}

          </Button>

        }

      >

        <form id="period-lock-form" action={formAction} className="grid max-w-md gap-3">

          <input type="hidden" name="year" value={currentYear} />

          <input type="hidden" name="month" value={currentMonth} />

          <div className="grid gap-2">

            <Label>Status</Label>

            <Select name="status" defaultValue="soft_locked">

              <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>

                <SelectValue />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="open">Open</SelectItem>

                <SelectItem value="soft_locked">Soft locked</SelectItem>

                <SelectItem value="fully_locked">Fully locked</SelectItem>

              </SelectContent>

            </Select>

          </div>

          <div className="grid gap-2">

            <Label htmlFor="period_reason">Reason</Label>

            <Textarea

              id="period_reason"

              name="reason"

              required

              placeholder="Month-end close, audit preparation…"

              rows={2}

              className="min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"

            />

          </div>

        </form>

      </OperationalFormSection>



      <Dialog open={lockTarget !== null} onOpenChange={() => setLockTarget(null)}>

        <DialogContent>

          <DialogHeader>

            <DialogTitle>Update period lock</DialogTitle>

            <DialogDescription>

              {lockTarget

                ? `Change ${lockTarget.year}-${String(lockTarget.month).padStart(2, "0")} lock status.`

                : null}

            </DialogDescription>

          </DialogHeader>

          {lockTarget ? (

            <form action={formAction} className="grid gap-3">

              <input type="hidden" name="period_id" value={lockTarget.id} />

              <input type="hidden" name="year" value={lockTarget.year} />

              <input type="hidden" name="month" value={lockTarget.month} />

              <div className="grid gap-2">

                <Label>New status</Label>

                <Select

                  name="status"

                  value={newStatus}

                  onValueChange={setNewStatus}

                >

                  <SelectTrigger>

                    <SelectValue />

                  </SelectTrigger>

                  <SelectContent>

                    <SelectItem value="open">Open</SelectItem>

                    <SelectItem value="soft_locked">Soft locked</SelectItem>

                    <SelectItem value="fully_locked">Fully locked</SelectItem>

                  </SelectContent>

                </Select>

              </div>

              <div className="grid gap-2">

                <Label htmlFor="lock_reason">Reason</Label>

                <Textarea

                  id="lock_reason"

                  name="reason"

                  value={reason}

                  onChange={(e) => setReason(e.target.value)}

                  required

                  rows={2}

                />

              </div>

              <DialogFooter>

                <Button type="button" variant="outline" onClick={() => setLockTarget(null)}>

                  Cancel

                </Button>

                <Button type="submit" disabled={pending || !reason.trim()}>

                  {pending ? "Saving…" : "Update period"}

                </Button>

              </DialogFooter>

            </form>

          ) : null}

        </DialogContent>

      </Dialog>

    </div>

  );

}


