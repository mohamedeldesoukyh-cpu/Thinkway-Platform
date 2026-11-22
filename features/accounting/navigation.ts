/** Accounting navigation only. Authorization remains enforced by the existing APIs/RLS. */
export type NavigationLanguage = 'en' | 'ar';
export const accountingGroups = [
  {id:'transactions',en:'Transactions',ar:'المعاملات'},
  {id:'receipts',en:'Receipts',ar:'المقبوضات'},
  {id:'payments',en:'Payments',ar:'المدفوعات'},
  {id:'third-parties',en:'Third Parties',ar:'الأطراف الثالثة'},
  {id:'general-ledger',en:'General Ledger',ar:'الأستاذ العام'},
  {id:'banking',en:'Banking',ar:'البنوك'},
  {id:'budgets',en:'Budgets',ar:'الموازنات'},
  {id:'reports',en:'Reports',ar:'التقارير'},
  {id:'administration',en:'Administration',ar:'الإدارة'},
  {id:'settings',en:'Settings',ar:'الإعدادات'},
] as const;
export type AccountingGroup = typeof accountingGroups[number]['id'];
export type AccountingView = 'recurring'|'scheduled-reversal'|'opening'|'transfers'|'approvals'|'transaction-locks'|'approval-policy'|'journals'|'expenses'|'invoices'|'costs'|'moves'|'receipts'|'payments'|'parties'|'vendors'|'chart'|'auxiliaries'|'years'|'periods'|'ledger'|'trial'|'statements'|'users'|'company'|'mapping';
export type NavigationItem = {
  id:string; parent:AccountingGroup; en:string; ar:string; status:'Ready'|'Partial'|'Pending';
  view?:AccountingView; route?:string; permission:'accounting'|'admin'; navigation:boolean; evidence:string;
};
const ready = (view:AccountingView,parent:AccountingGroup,en:string,ar:string,evidence:string,permission:'accounting'|'admin'='accounting'):NavigationItem =>
  ({id:view,parent,en,ar,status:'Ready',view,route:'/accounting',permission,navigation:true,evidence});
const pending = (id:string,parent:AccountingGroup,en:string,ar:string,evidence:string):NavigationItem =>
  ({id,parent,en,ar,status:'Pending',permission:'accounting',navigation:false,evidence});
// Array order is display order; embedded capabilities deliberately have no duplicate navigation.
export const accountingNavigation:readonly NavigationItem[] = [
  ready('journals','transactions','General JV','القيود العامة','JournalDesk: balanced drafts, posting, reversal and preview.'),
  ready('expenses','transactions','Expenses JV','قيود المصروفات','JournalDesk expenses mode.'),
  ready('invoices','transactions','Platform invoice posting','ترحيل فواتير المنصة','InvoiceDesk: Media invoices, post/unpost/repost; creation stays in Media.'),
  ready('costs','transactions','Cost invoices','فواتير التكلفة','CostInvoiceDesk: supplier and internal provisional invoices.'),
  ready('moves','transactions','Transaction reclassification','إعادة تصنيف المعاملات','AccountMoves: move existing transactions; not a new transfer voucher.'),
  ready('receipts','receipts','Receipts & advance allocation','المقبوضات وتخصيص الدفعات المقدمة','SettlementDesk receipt: allocations, advances, reversal and printing.'),
  ready('payments','payments','Payments & advance allocation','المدفوعات وتخصيص الدفعات المقدمة','SettlementDesk payment: vendor allocations, advances and reversal.'),
  ready('parties','third-parties','Clients','العملاء','PartyAccountsDesk client preset; shared Media identities.'),
  ready('vendors','third-parties','Vendors / creators','الموردون وصناع المحتوى','PartyAccountsDesk vendor preset; assignment vendors only.'),
  ready('chart','general-ledger','Chart of accounts','دليل الحسابات','AccountingConsole account setup and chart.'),
  ready('auxiliaries','general-ledger','Auxiliaries & sharing','الحسابات المساعدة ومشاركتها','AuxiliaryDesk and account setup: own/shared/none, common UUIDs.'),
  ready('years','general-ledger','Fiscal years','السنوات المالية','AccountingConsole: fiscal years and monthly period generation.'),
  ready('periods','general-ledger','Accounting periods & locks','الفترات المحاسبية وإقفالها','JournalDesk periods: period locking/unlocking, not individual locks.'),
  ready('ledger','reports','General ledger','الأستاذ العام','JournalDesk ledger: posted GL entries.'),
  ready('trial','reports','Trial balance','ميزان المراجعة','JournalDesk trial: posted debit/credit balances.'),
  ready('statements','reports','Account, auxiliary & Third Party statements','كشوف الحسابات والحسابات المساعدة والأطراف','StatementDesk: GL, auxiliary, client/vendor, consolidated and unsettled views.'),
  ready('users','administration','Module access rights','صلاحيات الوحدات','AccountingConsole existing admin-only module access editor.','admin'),
  ready('company','settings','Company & base currency','الشركة والعملة الأساسية','AccountingConsole company configuration; exchange rates remain shared Media settings.'),
  ready('mapping','settings','Media posting mappings','ربط ترحيلات المنصة','MappingDesk: revenue, costs, AF, UR, VAT, AR/AP, advances, FX and reserved mappings.'),
  ready('recurring','transactions','Recurring JV','القيود الدورية','Saved templates generate due drafts at current rates.'),
  ready('scheduled-reversal','transactions','Scheduled reversing JV','القيود العكسية المجدولة','Explicit execution of due reversals at original rates.'),
  ready('opening','transactions','Opening balance workflow','الأرصدة الافتتاحية','Balanced opening GL journals at fiscal start.'),
  ready('transfers','transactions','Account transfers','التحويلات بين الحسابات','Two-destination GL/auxiliary transfer vouchers.'),
  ready('approvals','transactions','Journal approvals','اعتماد القيود','Independent approval of saved manual drafts when enabled per company.'),
  ready('transaction-locks','transactions','Transaction locks & history','قفل المعاملات وسجل التحكم','Individual/bulk lock, administrator unlock, approval and lock history.'),
  ready('approval-policy','settings','Journal approval policy','سياسة اعتماد القيود','Administrator-managed optional independent approval; direct posting by default.','admin'),
  pending('payment-preparation','payments','Payment preparation','إعداد المدفوعات','No separate payment batch preparation workflow.'),
  pending('cheques','payments','Cheque payments','مدفوعات الشيكات','No cheque register or clearing workflow.'),
  pending('bank-accounts','banking','Bank account management','إدارة الحسابات البنكية','GL bank accounts and auxiliaries exist; no dedicated bank master workflow.'),
  pending('reconciliation','banking','Bank reconciliation','التسوية البنكية','No bank import/matching/reconciliation workflow.'),
  pending('bank-movements','banking','Cash and bank movements','حركة النقدية والبنوك','Movements can be inspected through General ledger; no dedicated banking screen.'),
  pending('budget-setup','budgets','Budget setup & allocation','إعداد وتوزيع الموازنة','Future GL/fiscal-period budgets; Media assignment budgets are operational.'),
  pending('budget-control','budgets','Budget control & variance','رقابة الموازنة وتحليل الانحرافات','Depends on accounting budget setup.'),
  pending('financial-statements','reports','Profit & loss, balance sheet, cash flow','الأرباح والخسائر والميزانية والتدفقات النقدية','Dedicated GL financial statements absent; Media P&L is operational.'),
  pending('aging','reports','Client / vendor aging','أعمار أرصدة العملاء والموردين','Unsettled statements exist; aging buckets report absent.'),
  pending('budget-reports','reports','Budget reports','تقارير الموازنة','Depends on accounting budgets.'),
  pending('closing','general-ledger','Fiscal year closing','إقفال السنة المالية','System accounts reserved; no closing workflow.'),
  {...pending('audit-viewer','administration','Audit logs & activity history','سجل التدقيق والنشاط','Database audit records exist; dedicated accounting viewer absent.'),status:'Partial'},
  {...pending('global-administration','administration','Shared users, roles & permissions','المستخدمون والأدوار والصلاحيات المشتركة','Existing /settings/users, /settings/roles, /settings/permissions, /settings/access-control in Media; existing module switch preserves access. No duplicate admin screens.'),status:'Partial'},
  {...pending('exchange-rates','settings','Shared currencies & exchange rates','العملات وأسعار الصرف المشتركة','Existing /finance/exchange-rates in Media; accounting uses shared rates. No new cross-module permission grant.'),status:'Partial'},
];
export function visibleAccountingNavigation(access:{accounting:boolean;admin:boolean}) {
  return accountingNavigation.filter(item=>access.accounting && item.navigation && item.status!=='Pending' && item.route && item.view && (item.permission!=='admin'||access.admin));
}
