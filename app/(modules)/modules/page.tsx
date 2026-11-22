import Link from "next/link";
import { ModuleSignOut } from "@/components/layout/module-sign-out";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import { loadModuleAccess, moduleHome } from "@/lib/auth/module-access";
import { resolveWorkspaceActor, isPortalActor } from "@/lib/security/workspace-actor";
import { portalHomePath } from "@/lib/security/workspace-auth";
import "@/features/accounting/accounting.css";

async function ModuleChoices() {
  const {user,fullName} = await getRequestAuth();
  if (!user) redirect("/login?next=%2Fmodules");
  const db = await createSupabaseServerClient();
  const actor = await resolveWorkspaceActor(db,user.id);
  if (isPortalActor(actor.kind)) redirect(portalHomePath(actor.kind));
  const access = await loadModuleAccess(db);
  if (access.media !== access.accounting) redirect(moduleHome(access));
  return <main className="tw-accounting tw-ac-module-picker"><div className="tw-ac-picker-inner"><span className="tw-ac-eyebrow">THINKWAY WORKSPACE</span><h1>Welcome{fullName ? `, ${fullName}` : ""}</h1><p>{access.media ? "Choose where you want to work." : "No module is assigned to your account. Contact your administrator."}</p><div className="tw-ac-module-cards">{access.media && <Link href="/media"><span>TW</span><h2>Media</h2><p>Clients, campaigns, billing and operations.</p><strong>Open TW Media</strong></Link>}{access.accounting && <Link href="/accounting"><span>TW</span><h2>Accounting</h2><p>Company books, chart of accounts and fiscal setup.</p><strong>Open TW Accounting</strong></Link>}</div><ModuleSignOut /></div></main>;
}
export default function ModulesPage() { return <Suspense fallback={<p>Loading your modules…</p>}><ModuleChoices /></Suspense>; }
