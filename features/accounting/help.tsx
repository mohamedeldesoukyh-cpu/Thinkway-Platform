// Inherits AccountingWorkspace's client boundary.
import { useState } from 'react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const shortcuts=[["Ctrl+F", "Search voucher numbers; Enter runs the search."], ["Ctrl+M", "Open the selected account’s mini statement."], ["F2", "Open the field lookup. Type a prefix to filter."], ["Ctrl+S", "Save the current entry. Receipts/payments run Save/Post after allocation review."], ["Ctrl+Alt+P", "Preview the current report, chart or voucher."], ["Ctrl+P", "Preview JV or receipt/payment print pages."], ["Enter / ↑ / ↓", "In lookups: Enter opens/selects a row; arrows move between rows."], ["Tab / Shift+Tab", "Next / previous editable cell; skips disabled fields and lookup icons."], ["Ctrl+Enter", "Add a journal line or advance row. Chrome reserves Ctrl+N."], ["Ctrl+Z", "Undo an unsaved JV edit; header Discard restores the saved JV."], ["Ctrl+Y", "Redo an undone JV edit or discarded changes."], ["Esc", "Close preview, lookup or dialog; then return to Accounting home. Unsaved JV changes require confirmation."]];

export function AccountingHelp() {
  const [open, setOpen] = useState(false);
  return <>
    <DropdownMenu><DropdownMenuTrigger className="tw-ac-button">Help</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>setOpen(true)}>Keyboard shortcuts</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="tw-accounting tw-ac-edit-dialog" style={{ minHeight: 0 }}>
        <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle><DialogDescription>Keyboard shortcuts work in the relevant entry form. Validation and posting permissions still apply.</DialogDescription></DialogHeader>

        <table className="tw-ac-journal-table"><thead><tr><th>Shortcut</th><th>Action</th></tr></thead><tbody>{shortcuts.map(([key,action])=><tr key={key}><td>{key}</td><td>{action}</td></tr>)}</tbody></table>
      </DialogContent>
    </Dialog>
  </>;
}
