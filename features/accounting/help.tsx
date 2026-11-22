// Inherits AccountingWorkspace's client boundary.
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AccountingHelp() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="tw-ac-button" onClick={() => setOpen(true)}>Help</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="tw-accounting tw-ac-edit-dialog" style={{ minHeight: 0 }}>
        <DialogHeader><DialogTitle>Accounting Help</DialogTitle><DialogDescription>Keyboard shortcuts work in the relevant entry form. Validation and posting permissions still apply.</DialogDescription></DialogHeader>
        <h3>Keyboard shortcuts</h3>
        <table className="tw-ac-journal-table"><thead><tr><th>Shortcut</th><th>Action</th></tr></thead><tbody>
          <tr><td>F2</td><td>Open lookup from an account, auxiliary, currency or Third Party field. Enter a code prefix first to narrow the results.</td></tr>
          <tr><td>Ctrl+S</td><td>Save the current journal, cost invoice or payment preparation. In receipts and payments, run the current save/post action after reviewing the allocation preview.</td></tr>
          <tr><td>Ctrl+P</td><td>Preview the journal or receipt/payment print pages.</td></tr>
          <tr><td>Ctrl+N</td><td>Add a journal line, or an advance row in a receipt or payment.</td></tr>
          <tr><td>Ctrl+Z</td><td>Undo the latest unsaved JV edit. Undo / Discard in the header restores the last saved JV.</td></tr>
          <tr><td>Ctrl+Y</td><td>Redo an undone JV edit or restore discarded unsaved changes.</td></tr>
          <tr><td>Esc</td><td>Close a lookup or help dialog.</td></tr>
        </tbody></table>
      </DialogContent>
    </Dialog>
  </>;
}
