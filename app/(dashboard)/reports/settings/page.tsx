import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { ReportSettings } from "@/features/reports/components/report-settings";
import { loadBuiltinReportSettings } from "@/features/reports/builtin-report-actions";
import { loadReportUsers } from "@/features/reports/saved-custom-report-actions";
export default async function ReportSettingsPage() {
  const [builtins, people] = await Promise.all([loadBuiltinReportSettings(), loadReportUsers()]);
  if (!people.ok) throw new Error(people.message);
  return <FinanceSuiteShell title="Report Settings" description="Manage saved and built-in reports." hideDefaultActions backFallbackHref="/reports" backLabel="Reports"><ReportSettings initial={builtins.settings.filter(r=>!builtins.hiddenIds.includes(r.id))} admin={builtins.admin} users={people.users}/></FinanceSuiteShell>;
}
