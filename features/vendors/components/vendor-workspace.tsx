"use client";

import { VendorEditSession, useVendorEditSession } from "./vendor-edit-session";
import { WorkspaceUndoProvider, useWorkspaceUndo } from "@/lib/productivity/workspace-undo";
import { creatorFinancialDisplay } from "@/features/vendors/financial-display";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import "@/app/styles/vendor-detail-suite.css";

import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
} from "@/components/workspace/operational-workspace-ui";
import { ClientProfilePlatformProvider } from "@/features/clients/components/client-form-ui";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorActivityTab } from "@/features/vendors/components/tabs/vendor-activity-tab";
import { VendorAssignmentsTab } from "@/features/vendors/components/tabs/vendor-assignments-tab";
import { VendorBillingTab } from "@/features/vendors/components/tabs/vendor-billing-tab";
import { VendorCommercialTab } from "@/features/vendors/components/tabs/vendor-commercial-tab";
import { VendorContractsTab } from "@/features/vendors/components/tabs/vendor-contracts-tab";
import { VendorDocumentsTab } from "@/features/vendors/components/tabs/vendor-documents-tab";
import { VendorOverviewTab } from "@/features/vendors/components/tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "@/features/vendors/components/tabs/vendor-platforms-tab";
import { VendorQuotationsTab } from "@/features/vendors/components/tabs/vendor-quotations-tab";
import { VENDOR_STATUS_OPTIONS } from "@/features/vendors/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import type { CompletenessBreakdown } from "@/lib/creators/crm/completeness";
import { cn } from "@/lib/utils";
import type { InfluencerStatus } from "@/types/database";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
  portalAccessPanel?: React.ReactNode;
  creatorSocialPanel?: React.ReactNode;
  currencyOptions?: { value: string; label: string }[];
};

const VENDOR_WORKSPACE_TAB_IDS = [
  "overview",
  "commercial",
  "platforms",
  "assignments",
  "quotations",
  "billing",
  "documents",
  "contracts",
  "activity",
] as const;

type VendorWorkspaceTabId = (typeof VENDOR_WORKSPACE_TAB_IDS)[number];

function isVendorWorkspaceTabId(value: string): value is VendorWorkspaceTabId {
  return (VENDOR_WORKSPACE_TAB_IDS as readonly string[]).includes(value);
}


function statusTone(status: InfluencerStatus): string {
  if (status === "active") return "";
  if (status === "blacklisted") return "r";
  return "";
}

function statusLabel(status: InfluencerStatus): string {
  return VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}


function CompletenessPill({completeness,onSelect}:{completeness:CompletenessBreakdown|null;onSelect:(code:string)=>void}) {
 const missing=completeness?.missing??[];
 return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="tw-cpill" aria-label="Show missing creator details">{Math.round(completeness?.overall??0)}% complete · {missing.length} missing</button></DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="max-h-[60vh] w-80 overflow-y-auto"><div className="px-2 py-2 text-sm font-semibold">Missing details</div>{missing.length ? missing.map((item,index)=><DropdownMenuItem key={item.code} onSelect={()=>onSelect(item.code)} className="whitespace-normal"><span className="mr-2 text-muted-foreground">{index+1}.</span>{item.label.replace(/^Missing /i,"")}</DropdownMenuItem>):<div className="p-2 text-sm">No missing details.</div>}</DropdownMenuContent></DropdownMenu>;
}

const tabPanelClassName =
  "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

export function VendorWorkspaceView(props:VendorWorkspaceViewProps) { return <WorkspaceUndoProvider><VendorEditSession revision={props.workspace.updated_at}><VendorWorkspaceContent {...props}/></VendorEditSession></WorkspaceUndoProvider>; }

function VendorWorkspaceContent({
  workspace,
  defaultTab = "overview",
  portalAccessPanel,
  creatorSocialPanel,
  currencyOptions = [],
}: VendorWorkspaceViewProps) {
  const session=useVendorEditSession()!;
  const history=useWorkspaceUndo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [depOpen, setDepOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [missingTarget,setMissingTarget] = useState<string|null>(null);

  const countryLabel = useMemo(() => {
    return formatCreatorCountryLabels({
      country_code: workspace.country_code,
      country_codes: workspace.country_codes,
      estimated_country: null,
      platforms: (workspace.platform_accounts ?? []).map((account) => ({
        id: account.id,
        platform: account.platform,
        handle: account.handle,
        profile_url: account.profile_url ?? null,
        follower_count: account.follower_count,
        engagement_rate: account.engagement_rate,
        audience_country: account.audience_country ?? null,
      })),
    });
  }, [workspace.country_code, workspace.country_codes, workspace.platform_accounts]);

  const initialTab = isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview";
  const [activeTab, setActiveTab] = useState<VendorWorkspaceTabId>(initialTab);
  const [billingVisited,setBillingVisited]=useState(initialTab==="billing");

  useEffect(() => {
    setActiveTab(isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview");
  }, [defaultTab]);

  const handleCancel = useCallback(() => {
    router.push("/vendors");
  }, [router]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isVendorWorkspaceTabId(value)) {
        return;
      }
      if(value==="billing")setBillingVisited(true);
      setActiveTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const jumpToMissing = (code:string) => {
    const tab = code==='display_name'||code==='contact'||code==='country'?'overview':code==='rates'?'commercial':code==='platform'?'platforms':code==='vat_number'?'contracts':code==='bank'||code==='bank_verified'||code==='payment_terms'?'billing':'documents';
    if(!session.editing)session.start();
    setMissingTarget(code); handleTabChange(tab);
  };
  useEffect(()=>{
    if(!missingTarget) return;
    const selectors:Record<string,string>={display_name:'#display_name',contact:'#email',country:'#creator-country',rates:'[name="base_rate"]',platform:'#creator-add-platform',vat_number:'#tax_id',payment_terms:'#creator-payment-terms',bank:'.cbd-field input',bank_verified:'.cbd-field input'};
    const selector=selectors[missingTarget]??'#creator-missing-document button';
    let done=false;
    const focus=()=>{const field=document.querySelector<HTMLElement>(selector);if(!field||!field.getClientRects().length)return;field.scrollIntoView({block:'center',behavior:'smooth'});field.focus({preventScroll:true});done=true;};
    const frame=requestAnimationFrame(focus);
    const observer=new MutationObserver(()=>{if(!done)focus();});observer.observe(document.body,{childList:true,subtree:true});
    const timeout=setTimeout(()=>observer.disconnect(),5000);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();clearTimeout(timeout);};
  },[activeTab,missingTarget]);

  const { counts, financials } = workspace;
  const display = useMemo(() => creatorFinancialDisplay(workspace.assignments, workspace.payouts), [workspace.assignments, workspace.payouts]);

  const kpiItems = useMemo(
    () =>
      [
        ["Assignments", String(counts.assignments), ""],
        ["Campaigns", String(counts.campaigns), ""],
        ["Deliverables", String(counts.deliverables), counts.deliverables === 0 ? "r" : ""],
        ["Platforms", String(counts.platforms), ""],
        ["Client revenue", display.revenue, ""],
        ["Creator cost", display.cost, ""],
        ["GP", display.gp, ""],
        ["Margin", display.margin, "g"],
        [
          "Pending payout",
          display.pending,
          financials.pending_payout > 0 ? "r" : "",
        ],
      ] as const,
    [counts, display, financials]
  );

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview", count: "" },
        { id: "commercial" as const, label: "Commercial", count: "" },
        {
          id: "platforms" as const,
          label: "Platforms",
          count: String(counts.platforms),
        },
        {
          id: "assignments" as const,
          label: "Assignments",
          count: String(counts.assignments),
        },
        {
          id: "quotations" as const,
          label: "Quotations",
          count: String(workspace.quotation_history?.length ?? 0),
        },
        { id: "billing" as const, label: "Payments", count: financials.pending_payout > 0 ? "!" : "" },
        {
          id: "documents" as const,
          label: "Documents",
          count: String(workspace.documents.length),
        },
        { id: "contracts" as const, label: "Legal & contracts", count: "" },
        {
          id: "activity" as const,
          label: "Timeline",
          count: String(workspace.activity.length),
        },
      ] satisfies Array<{
        id: VendorWorkspaceTabId;
        label: string;
        count: string;
      }>,
    [
      counts.assignments,
      counts.platforms,
      financials.pending_payout,
      workspace.activity.length,
      workspace.documents.length,
      workspace.quotation_history?.length,
    ]
  );

  const metaParts = [
    countryLabel !== "—" ? countryLabel : null,
    counts.platforms ? `${counts.platforms} platforms` : null,
    counts.campaigns ? `${counts.campaigns} campaigns` : null,
  ].filter(Boolean);

  return (
    <ClientProfilePlatformProvider platformV6>
      <div className="vendor-detail-suite">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="tw-frozen">
            <div className="tw-mast">
              <div className="tw-mh">
                <Link href="/vendors" className="tw-hmk" aria-label="Back to vendors">
                  <i />
                  <u />
                </Link>
                <span className="tw-hwd">
                  THINK<em>WAY</em>
                </span>
                <span className="tw-hdv" />
                <span className="tw-vav tw-vav--photo" aria-hidden={false}>
                  <CreatorIdentityCell
                    source={creatorProfileSourceFromAccounts(
                      workspace.display_name,
                      workspace.platform_accounts,
                      { avatarUrl: workspace.primary_avatar_url }
                    )}
                    size="sm"
                    showName={false}
                    showHandle={false}
                    showPlatformBadge={false}
                    avatarBadge="none"
                    stopPropagation
                  />
                </span>
                <span className="id">
                  <DocumentNumber value={workspace.document_number} />
                </span>
                <h1>{workspace.display_name}</h1>
                <span className={cn("st", statusTone(workspace.status))}>
                  {statusLabel(workspace.status)}
                </span>
                {metaParts.length > 0 ? (
                  <span className="sub">{metaParts.join(" · ")}</span>
                ) : null}
                <span style={{ flex: 1 }} />
                <CompletenessPill completeness={workspace.crm_completeness} onSelect={jumpToMissing}/>
                <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="tw-b sm" aria-label="Actions">
                      <MoreHorizontalIcon className="size-3.5" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href="/vendors">Back to creators / search creators</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDepOpen(true)}>
                      View dependencies
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/operations/move?vendor=${workspace.id}`}>
                        Reassign via Move
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" className="tw-b sm" disabled={session.saving} onClick={session.editing?session.discard:session.start}>{session.editing?'Discard':'Edit'}</button>
                {session.editing&&<><button type="button" className="tw-b sm" aria-label="Undo (Ctrl+Z)" disabled={session.saving} onClick={()=>history?.step('undo')}>↶</button><button type="button" className="tw-b sm" aria-label="Redo (Ctrl+Y)" disabled={session.saving} onClick={()=>history?.step('redo')}>↷</button><button type="button" className="tw-b sm pri" disabled={session.saving} onClick={()=>void session.save()}>{session.saving?'Saving…':'Save changes'}</button></>}
              </div>

              <div className="tw-ms2" aria-label="Creator metrics">
                {kpiItems.map(([label, value, tone]) => (
                  <div key={label}>
                    <i>{label}</i>
                    <b className={tone || undefined}>{value}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="tw-step2" role="tablist" aria-label="Creator profile tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className="tw-sb"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <span className="tw-sb__d" />
                  <span className="tw-sb__l">
                    {tab.label}
                    {tab.count ? (
                      <em className={tab.count === "!" ? "r" : undefined}>
                        {tab.count === "!" ? "pending" : tab.count}
                      </em>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <fieldset disabled={!session.editing||session.saving} className="tw-main min-w-0 border-0">
            <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorOverviewTab
                  vendor={workspace}
                  portalAccessPanel={portalAccessPanel}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "overview"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="commercial" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorCommercialTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="platforms" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorPlatformsTab
                  vendor={workspace}
                  onCancel={handleCancel}
                  creatorSocialPanel={creatorSocialPanel}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="assignments" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorAssignmentsTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="quotations" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorQuotationsTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="billing" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {billingVisited ? (
                  <VendorBillingTab
                    workspace={workspace}
                    currencyOptions={currencyOptions}
                    onCancel={handleCancel}
                  />
                ) : null}
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="documents" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorDocumentsTab missingDocumentType={missingTarget??undefined} vendor={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="contracts" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorContractsTab
                  vendor={workspace}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "contracts"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="activity" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorActivityTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
          </fieldset>
        </Tabs>

        <VendorDependencyDialog
          vendorId={workspace.id}
          vendorName={workspace.display_name}
          open={depOpen}
          onOpenChange={setDepOpen}
          onArchive={
            workspace.counts.assignments === 0 ? () => setDepOpen(false) : undefined
          }
        />
      </div>
    </ClientProfilePlatformProvider>
  );
}
