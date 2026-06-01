"use client";

import { useActionState, useEffect, useState } from "react";
import { format } from "date-fns";
import { LockIcon, UnlockIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { updateFinancialPeriodAction } from "@/features/finance/actions";

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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockIcon className="size-5" />
            Financial period management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Soft lock blocks operational edits; finance can still edit. Full lock requires override access.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Locked by</TableHead>
                  <TableHead>Locked at</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No periods configured. Lock a month to begin governance.
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">
                        {period.year}-{String(period.month).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[period.status] ?? "outline"}>
                          {STATUS_LABELS[period.status] ?? period.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{period.locked_by_name ?? "—"}</TableCell>
                      <TableCell>
                        {period.locked_at
                          ? format(new Date(period.locked_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {period.notes ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLockTarget(period);
                            setNewStatus(period.status === "open" ? "soft_locked" : "open");
                          }}
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lock current month</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid max-w-md gap-3">
            <input type="hidden" name="year" value={currentYear} />
            <input type="hidden" name="month" value={currentMonth} />
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="soft_locked">
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
              <Label htmlFor="period_reason">Reason</Label>
              <Textarea
                id="period_reason"
                name="reason"
                required
                placeholder="Month-end close, audit preparation…"
                rows={2}
              />
            </div>
            <Button type="submit" disabled={pending}>
              Apply to {currentYear}-{String(currentMonth).padStart(2, "0")}
            </Button>
          </form>
        </CardContent>
      </Card>

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
