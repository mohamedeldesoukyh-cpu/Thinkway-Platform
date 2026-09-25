import {FinanceSuiteRoot} from '@/components/finance/suite';
import type {ReactNode} from 'react';

export default function CreatorInvoiceLayout({children}:{children:ReactNode}){
 return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
