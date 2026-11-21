import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import { requireFinancePermission } from "@/lib/auth/permissions-server";
import "@/features/accounting/accounting.css";

export const metadata: Metadata = { title: "TW Accounting" };

async function AccountingAccess({ children }: { children: React.ReactNode }) {
  const { user } = await getRequestAuth();
  if (!user) redirect("/login?next=%2Faccounting");
  const supabase = await createSupabaseServerClient();
  const access = await requireFinancePermission(supabase, "finance.read");
  if ("error" in access) return <main className="tw-accounting tw-accounting-access"><h1>Accounting access required</h1><p>{access.error}</p><Link href="/">Return to TW Media</Link></main>;
  return children;
}

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="tw-accounting tw-accounting-access">Opening TW Accounting…</main>}><AccountingAccess>{children}</AccountingAccess></Suspense>;
}
