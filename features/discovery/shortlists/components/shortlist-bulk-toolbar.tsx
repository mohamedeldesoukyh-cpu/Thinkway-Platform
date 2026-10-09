import { MoreHorizontalIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
type Props = {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  canManage: boolean;
  showSubmit: boolean;
  showStatusActions: boolean;
  showMove: boolean;
  busy?: boolean;
  onSubmitSelected: () => void;
  onRemoveSelected: () => void;
  onCompareSelected: () => void;
  onExportSelected: () => void;
  onRefreshMetrics?: () => void;
  onMoveSelected: () => void;
  onGenerateNewQuotation: () => void;
  onAddToQuotation: () => void;
  onSendToClient?: () => void;
  existingQuotationLabel?: string | null;
  onCollapseSelected?: () => void;
  showCollapse?: boolean;
  onUncollapseSelected?: () => void;
  showUncollapse?: boolean;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onCancelSelected: () => void;
  onClearSelection: () => void;
};


export function ShortlistBulkToolbar(p: Props) {
  if (!p.selectedCount) return null;
  const actions = [
    { label: "Approve", onClick: p.onApproveSelected, eligible: p.showStatusActions, reason: "needs review and approval permission" },
    { label: "Reject", onClick: p.onRejectSelected, eligible: p.showStatusActions, reason: "needs review and approval permission" },
    { label: "Cancel selected", onClick: p.onCancelSelected, eligible: p.canManage, reason: "editing unavailable" },
    { label: "Collapse", onClick: p.onCollapseSelected, eligible: p.showCollapse, reason: "select eligible creators" },
    { label: "Uncollapse", onClick: p.onUncollapseSelected, eligible: p.showUncollapse, reason: "select a collapsed group" },
    { label: "Refresh metrics", onClick: p.onRefreshMetrics, eligible: p.canManage, reason: "editing unavailable" },
    { label: "Export CSV", onClick: p.onExportSelected, eligible: true },
    { label: "Send to client", onClick: p.onSendToClient, eligible: p.canManage, reason: "editing unavailable" },
    { label: "Move to campaign", onClick: p.onMoveSelected, eligible: p.showMove && p.canManage, reason: "needs Approved" },
    { label: "Remove from shortlist", onClick: p.onRemoveSelected, eligible: p.showSubmit, reason: "needs editable shortlist" },
  ];
  return <div className="sl-selbar" role="toolbar" aria-label="Selected creator actions">
    <div className="sl-selbar__n"><b>{p.selectedCount}</b><span>of {p.totalCount} selected</span></div>
    <button className="q-b q-b--sm" onClick={p.onClearSelection} disabled={p.busy}>Clear</button>
    <button className="q-b q-b--sm" onClick={p.onSelectAll} disabled={p.busy || p.selectedCount === p.totalCount}>Select all {p.totalCount}</button>
    <span className="q-sp" />
    <button className="q-b q-b--sm" onClick={p.onGenerateNewQuotation} disabled={p.busy || !p.canManage}>Generate quotation</button>
    <button className="q-b q-b--sm" onClick={p.onAddToQuotation} disabled={p.busy || !p.canManage} title={p.existingQuotationLabel ?? undefined}>Add to quotation</button>
    <button className="q-b q-b--sm" onClick={p.onCompareSelected} disabled={p.busy || p.selectedCount < 2}>Compare</button>
    <button className="q-b q-b--sm" onClick={p.onSubmitSelected} disabled={p.busy || !p.showSubmit}>Submit selected</button>
    <DropdownMenu><DropdownMenuTrigger asChild><button className="q-b q-b--sm q-b--icon" aria-label="More selected creator actions"><MoreHorizontalIcon className="size-4" /></button></DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="sl-bulk-menu">
        {actions.map(a => <DropdownMenuItem key={a.label} disabled={p.busy || !a.eligible || !a.onClick} onSelect={() => a.onClick?.()}><span>{a.label}</span>{!a.eligible && <small>{a.reason}</small>}</DropdownMenuItem>)}
        <p className="px-2 py-2 text-[10px] text-muted-foreground">Remove affects this shortlist only. Collapse groups rows; it does not merge creators.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
