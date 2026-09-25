import Link from 'next/link';
import type {ReactNode} from 'react';
import {DashboardShell} from '@/components/layout/dashboard-shell';
import {PageBackButton} from '@/components/navigation/page-back-button';
import '@/app/styles/collections-platform-shared.css';
import '@/app/styles/collections-fragment.css';
import '@/app/styles/finance-ledger.css';

export function FinanceLedgerShell({title,description,active,children}:{title:string;description:string;active:'vat'|'invoices';children:ReactNode}){
 return <DashboardShell title={title} hidePageHeader hideDesktopHeader mainClassName="tw-main"><div className="collections-suite finance-ledger">
  <header className="tw-mast"><div className="tw-mh"><span className="id">FINANCE</span><h1>{title}</h1><span className="sub">{description}</span><span className="tw-sp"/><PageBackButton fallbackHref="/billing" variant="text" className="tw-b"/></div>
   <nav className="tw-ch" aria-label="Finance records"><Link className="tw-b" href="/billing">Billing</Link><Link className={`tw-b${active==='invoices'?' pri':''}`} aria-current={active==='invoices'?'page':undefined} href="/billing/creator-invoices">Creator invoices</Link><Link className={`tw-b${active==='vat'?' pri':''}`} aria-current={active==='vat'?'page':undefined} href="/finance/vat">VAT statement</Link><Link className="tw-b" href="/collections?tab=record">Client payments</Link></nav>
  </header>{children}
 </div></DashboardShell>;
}
