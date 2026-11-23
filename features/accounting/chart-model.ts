export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
export type Account = {
  code: string;
  name: string;
  parent: string | null;
  type: AccountType;
  normal: "Debit" | "Credit";
  kind: "Group" | "Posting" | "Control" | "System";
  subledger?: string;
  directoryKind?: string;
};


export function isWithin(account: Account, ancestor: string, accounts: Account[]): boolean {
  let current: Account | undefined = account;
  const visited = new Set<string>();
  while (current && !visited.has(current.code)) {
    if (current.code === ancestor) return true;
    visited.add(current.code);
    current = accounts.find((item) => item.code === current?.parent);
  }
  return false;
}

export function chartCsv(accounts: (Account & {active?:boolean; nameAr?:string})[]): string {
  const rows = [["Code", "Account name", "Parent code", "Type", "Normal balance", "Account use", "Subledger", "Status", "Arabic name"], ...accounts.map(a => [a.code, a.name, a.parent ?? "", a.type, a.normal, a.kind, a.subledger ?? "", a.active === false ? "Inactive" : "Active", a.nameAr ?? ""])];
  const escape = (value:string) => {
    const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map(row => row.map(escape).join(",")).join("\r\n");
}
