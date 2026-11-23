export const reportTransactionTypes = [
  ['journal','General JV'], ['receipt','Receipts'], ['payment','Payments'],
  ['invoice','Sales invoices'], ['cost','Cost invoices'],
  ['client_credit_note','Client CN'], ['vendor_credit_note','Supplier CN'],
  ['client_debit_note','Client DN'], ['vendor_debit_note','Supplier DN'],
  ['expense','Expenses'], ['transfer','Account transfers'],
  ['opening','Opening balances'], ['closing','P&L closing'],
] as const;
