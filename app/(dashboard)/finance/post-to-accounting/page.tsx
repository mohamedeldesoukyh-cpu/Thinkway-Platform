import { PostingPageHeader } from "@/features/finance/posting-center/components/posting-page-header";
import { FinanceSuiteShell } from '@/components/finance/suite/finance-suite-shell';
import { accountingContext } from '@/features/accounting/setup-server';
import { requireFinancePermission } from '@/lib/auth/permissions-server';
import { AccountingPostingQueue } from '@/features/finance/posting-center/components/accounting-posting-queue';

export default async function PostToAccountingPage() {
  const { db, access } = await accountingContext();
  const permission = await requireFinancePermission(db, 'finance.read');
  if (!access.media || 'error' in permission) throw Error('Media Finance access required');
  const companies = await db.from('tw_accounting_companies').select('id,name').order('created_at');
  if (companies.error) throw Error('Could not load Accounting configuration');
  const company = companies.data?.find(c=>c.name.trim().toLowerCase()==='thinkway') ?? (companies.data?.length===1?companies.data[0]:null);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  return <FinanceSuiteShell header={<PostingPageHeader/>} hideDefaultActions backFallbackHref="/finance" title="Post to Accounting" description="Media invoices, credit notes and debit notes → Accounting journals">
    {company ? <AccountingPostingQueue company={company.id} manage={access.manage} today={today}/> : <p>Configure the accounting company before posting.</p>}
  </FinanceSuiteShell>;
}
