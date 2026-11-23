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
export type AccountingView = 'home'|'monthly-accruals'|'staff'|'pl-closing'|'customer-advances'|'vendor-advances'|'balance-sheet'|'cash-flow'|'vendor-aging'|'auxiliary-statements'|'client-statements'|'vendor-statements'|'unsettled-receivables'|'unsettled-payables'|'closing'|'audit-viewer'|'budget-setup'|'budget-control'|'budget-reports'|'financial-statements'|'aging'|'payment-preparation'|'cheques'|'banks'|'reconciliation'|'bank-movements'|'recurring'|'scheduled-reversal'|'opening'|'transfers'|'approvals'|'transaction-locks'|'approval-policy'|'journals'|'expenses'|'invoices'|'costs'|'moves'|'receipts'|'payments'|'parties'|'vendors'|'chart'|'auxiliaries'|'years'|'periods'|'ledger'|'trial'|'statements'|'users'|'company'|'mapping';
export type NavigationItem = {
  id:string; parent:AccountingGroup; en:string; ar:string; status:'Ready'|'Partial'|'Pending';
  view?:AccountingView; route?:string; permission:'accounting'|'admin'; navigation:boolean;
};
const ready = (view:AccountingView,parent:AccountingGroup,en:string,ar:string,permission:'accounting'|'admin'='accounting'):NavigationItem =>
  ({id:view,parent,en,ar,status:'Ready',view,route:'/accounting',permission,navigation:true});
const pending = (id:string,parent:AccountingGroup,en:string,ar:string):NavigationItem =>
  ({id,parent,en,ar,status:'Pending',permission:'accounting',navigation:false});
// Array order is display order; embedded capabilities deliberately have no duplicate navigation.
export const accountingNavigation:readonly NavigationItem[] = [
  ready('journals','transactions','General JV','القيود العامة'),
  ready('expenses','transactions','Expenses JV','قيود المصروفات'),
  ready('invoices','transactions','Platform invoice posting','ترحيل فواتير المنصة'),
  ready('costs','transactions','Cost invoices','فواتير التكلفة'),
  ready('moves','transactions','Transaction reclassification','إعادة تصنيف المعاملات'),
  ready('receipts','receipts','Receipts','المقبوضات وتخصيص الدفعات المقدمة'),
  ready('customer-advances','receipts','Customer Advance Allocation','تخصيص الدفعات المقدمة للعملاء'),
  ready('vendor-advances','payments','Vendor Advance Allocation','تخصيص الدفعات المقدمة للموردين'),
  ready('payments','payments','Payments','المدفوعات وتخصيص الدفعات المقدمة'),
  ready('parties','third-parties','Clients','العملاء'),
  ready('vendors','third-parties','Vendors / creators','الموردون وصناع المحتوى'),
  ready('staff','third-parties','Staff','الموظفون'),
  ready('chart','general-ledger','Chart of accounts','دليل الحسابات'),
  ready('auxiliaries','general-ledger','Auxiliaries & sharing','الحسابات المساعدة ومشاركتها'),
  ready('monthly-accruals','general-ledger','Monthly live-ad accruals','استحقاقات الإعلانات الشهرية'),
  ready('pl-closing','general-ledger','Close P&L Accounts','إقفال حسابات الأرباح والخسائر'),
  ready('years','general-ledger','Fiscal years','السنوات المالية'),
  ready('periods','general-ledger','Accounting periods & locks','الفترات المحاسبية وإقفالها'),
  ready('ledger','reports','General ledger','الأستاذ العام'),
  ready('trial','reports','Trial balance','ميزان المراجعة'),
  ready('statements','reports','Statement of Account','كشوف الحسابات والحسابات المساعدة والأطراف'),
  ready('auxiliary-statements','reports','Auxiliary Statement','كشف الحساب المساعد'),
  ready('client-statements','reports','Third Party Statement — Clients','كشف الطرف الثالث — العملاء'),
  ready('vendor-statements','reports','Third Party Statement — Vendors','كشف الطرف الثالث — الموردون'),
  ready('unsettled-receivables','reports','Unsettled Receivables','الفواتير المدينة غير المسددة'),
  ready('unsettled-payables','reports','Unsettled Payables','الفواتير الدائنة غير المسددة'),
  ready('balance-sheet','reports','Balance Sheet','الميزانية العمومية'),
  ready('cash-flow','reports','Cash Flow','التدفقات النقدية'),
  ready('vendor-aging','reports','Vendor Aging','أعمار أرصدة الموردين'),
  ready('users','administration','Module access rights','صلاحيات الوحدات','admin'),
  ready('company','settings','Company, currencies & working year','الشركة والعملة الأساسية'),
  ready('mapping','settings','Media posting mappings','ربط ترحيلات المنصة'),
  ready('recurring','transactions','Recurring JV','القيود الدورية'),
  ready('scheduled-reversal','transactions','Scheduled reversing JV','القيود العكسية المجدولة'),
  ready('opening','transactions','Opening balance workflow','الأرصدة الافتتاحية'),
  ready('transfers','transactions','Account transfers','التحويلات بين الحسابات'),
  ready('approvals','transactions','Journal approvals','اعتماد القيود'),
  ready('transaction-locks','transactions','Transaction locks & history','قفل المعاملات وسجل التحكم'),
  ready('approval-policy','settings','Journal approval policy','سياسة اعتماد القيود','admin'),
  ready('payment-preparation','payments','Payment preparation','إعداد المدفوعات'),
  ready('cheques','payments','Cheque payments','مدفوعات الشيكات'),
  ready('banks','banking','Bank account management','إدارة الحسابات البنكية'),
  ready('reconciliation','banking','Bank reconciliation','التسوية البنكية'),
  ready('bank-movements','banking','Cash and bank movements','حركة النقدية والبنوك'),
  ready('budget-setup','budgets','Budget setup & allocation','إعداد وتوزيع الموازنة'),
  ready('budget-control','budgets','Budget control & variance','رقابة الموازنة وتحليل الانحرافات'),
  ready('financial-statements','reports','Profit & Loss','الأرباح والخسائر والميزانية والتدفقات النقدية'),
  ready('aging','reports','Client Aging','أعمار أرصدة العملاء والموردين'),
  ready('budget-reports','reports','Budget reports','تقارير الموازنة'),
  ready('closing','general-ledger','Fiscal year closing','إقفال السنة المالية'),
  ready('audit-viewer','administration','Audit logs & activity history','سجل التدقيق والنشاط','admin'),
  {...pending('global-administration','administration','Shared users, roles & permissions','المستخدمون والأدوار والصلاحيات المشتركة'),status:'Partial'},
  {...pending('exchange-rates','settings','Shared currencies & exchange rates','العملات وأسعار الصرف المشتركة'),status:'Partial'},
];
export function visibleAccountingNavigation(access:{accounting:boolean;admin:boolean}) {
  return accountingNavigation.filter(item=>access.accounting && item.navigation && item.status!=='Pending' && item.route && item.view && (item.permission!=='admin'||access.admin));
}
