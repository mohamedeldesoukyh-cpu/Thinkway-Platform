import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestAuth } from "@/lib/supabase/server";
import { accountingContext } from "@/features/accounting/setup-server";
import "@/features/accounting/accounting.css";

export const metadata: Metadata = { title: "TW Accounting" };

async function AccountingAccess({ children }: { children: React.ReactNode }) {
  const { user } = await getRequestAuth();
  if (!user) redirect("/login?next=%2Faccounting");
  try { await accountingContext(); }
  catch(e) { return <main className="tw-accounting tw-accounting-access"><h1>Accounting access required</h1><p>{e instanceof Error ? e.message : "Access could not be verified"}</p><Link href="/modules">Your modules</Link><br/><Link href={e instanceof Error && e.message.includes("enrollment") ? "/auth/mfa/enroll?next=%2Faccounting" : "/auth/mfa?next=%2Faccounting"}>Verify sign-in</Link></main>; }
  return children;
}

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="tw-accounting tw-accounting-access">Opening TW Accounting…</main>}><AccountingAccess>{children}</AccountingAccess></Suspense>;
}
