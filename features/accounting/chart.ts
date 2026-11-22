export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
export type Account = {
  code: string;
  name: string;
  parent: string | null;
  type: AccountType;
  normal: "Debit" | "Credit";
  kind: "Group" | "Posting" | "Control" | "System";
  subledger?: string;
};

// Versioned starter chart. No balances or operational records are seeded.
const sections: [string, string, AccountType, [string, string, string[]][]][] = [
  ["100000", "Assets", "Asset", [
    ["110000", "Cash and banks", ["111001|Petty Cash", "112001|Main Operating Bank", "112002|Foreign Currency Bank", "113001|Transfers in Transit"]],
    ["120000", "Receivables", ["121001|Trade Accounts Receivable|Customer", "122001|Unbilled Revenue / Contract Assets|Customer", "123001|Allowance for Credit Losses||Credit"]],
    ["130000", "Advances and prepayments", ["131001|Supplier and Creator Advances|Supplier / creator", "132001|Staff Advances|Employee", "133001|Prepaid Expenses", "134001|Refundable Deposits"]],
    ["140000", "Recoverable taxes", ["141001|Recoverable Input VAT|Supplier / creator", "142001|Customer Withholding Tax Receivable|Customer"]],
    ["150000", "Fixed assets", ["151001|Computers and Equipment", "152001|Furniture and Fixtures", "153001|Vehicles", "154001|Leasehold Improvements", "159001|Accumulated Depreciation — Computers||Credit", "159002|Accumulated Depreciation — Furniture||Credit", "159003|Accumulated Depreciation — Vehicles||Credit", "159004|Accumulated Depreciation — Leasehold Improvements||Credit"]],
  ]],
  ["200000", "Liabilities", "Liability", [
    ["210000", "Payables", ["211001|Trade Accounts Payable|Supplier / creator", "212001|Accrued Campaign Costs", "213001|Accrued Operating Expenses"]],
    ["220000", "Customer advances", ["221001|Customer Advances / Deferred Revenue|Customer"]],
    ["230000", "Taxes payable", ["231001|Output VAT|Customer", "232001|Supplier Withholding Tax Payable|Supplier / creator", "233001|Payroll Tax Payable", "234001|Social Insurance Payable", "235001|Corporate Income Tax Payable"]],
    ["240000", "Other liabilities", ["241001|Salaries Payable", "242001|Employee Reimbursements Payable|Employee", "243001|Loans Payable"]],
  ]],
  ["300000", "Equity", "Equity", [
    ["310000", "Capital", ["311001|Share Capital", "312001|Additional Capital Contributions"]],
    ["320000", "Reserves and earnings", ["321001|Retained Earnings", "322001|Current-Year Earnings||Credit|System", "323001|Approved Distributions||Debit"]],
  ]],
  ["400000", "Revenue", "Revenue", [
    ["410000", "Service revenue", ["411001|Influencer Campaign Revenue", "412001|Media Buying Revenue", "413001|Creative and Production Revenue", "414001|Management and Retainer Fees", "415001|Commission Revenue"]],
    ["420000", "Revenue deductions", ["421001|Sales Discounts and Allowances||Debit"]],
  ]],
  ["500000", "Direct costs", "Expense", [
    ["510000", "Campaign delivery", ["511001|Creator and Influencer Costs", "512001|Media Placement Costs", "513001|Production Costs", "514001|Campaign Freelancers", "515001|Campaign Travel and Logistics"]],
  ]],
  ["600000", "Operating expenses", "Expense", [
    ["610000", "People costs", ["611001|Salaries", "612001|Bonuses and Incentives", "613001|Employer Social Insurance", "614001|Staff Benefits and Medical Insurance"]],
    ["620000", "Office and administration", ["621001|Rent", "622001|Utilities and Internet", "623001|Software and Subscriptions", "624001|Professional and Legal Fees", "625001|Office Supplies", "626001|Travel and Transportation"]],
    ["630000", "Other operating costs", ["631001|Marketing and Business Development", "632001|Bank Charges", "634001|Credit Loss Expense"]],
    ["633000", "Depreciation expenses", ["633001|Depreciation — Computers and Equipment", "633002|Depreciation — Furniture and Fixtures", "633003|Depreciation — Vehicles", "633004|Depreciation — Leasehold Improvements"]],
  ]],
  ["700000", "Other income and expenses", "Expense", [
    ["710000", "Other income", ["711001|Interest Income||Credit", "712001|Realized Foreign Exchange Gains||Credit", "713001|Unrealized Foreign Exchange Gains||Credit"]],
    ["720000", "Other expenses", ["721001|Interest Expense", "722001|Realized Foreign Exchange Losses", "723001|Unrealized Foreign Exchange Losses"]],
  ]],
  ["800000", "Income tax", "Expense", [
    ["810000", "Income tax expense", ["811001|Income Tax Expense"]],
  ]],
];

export const CHART: Account[] = sections.flatMap(([code, name, type, groups]) => {
  const normal = type === "Asset" || type === "Expense" ? "Debit" : "Credit";
  return [
    { code, name, parent: null, type, normal, kind: "Group" } as Account,
    ...groups.flatMap(([groupCode, groupName, entries]) => {
      const groupType = groupCode === "710000" ? "Revenue" : type;
      const groupNormal = groupCode === "710000" ? "Credit" : normal;
      return [
        { code: groupCode, name: groupName, parent: groupCode === "633000" ? "630000" : code, type: groupType, normal: groupNormal, kind: "Group" } as Account,
        ...entries.map((entry): Account => {
          const [entryCode, entryName, subledger, side, kind] = entry.split("|");
          return { code: entryCode, name: entryName, parent: groupCode, type: groupType, normal: (side || groupNormal) as Account["normal"], kind: kind === "System" ? "System" : subledger ? "Control" : "Posting", ...(subledger ? { subledger } : {}) };
        }),
      ];
    }),
  ];
}).sort((a, b) => a.code.localeCompare(b.code));

export function isWithin(account: Account, ancestor: string, accounts = CHART): boolean {
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
