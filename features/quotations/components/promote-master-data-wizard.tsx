"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENCY_OR_DIRECT_OPTIONS, COUNTRY_OPTIONS } from "@/features/clients/constants";
import { CLIENT_INDUSTRY_OPTIONS } from "@/lib/master-data/constants";
import {
  checkPromoteMasterDataDuplicateWarnings,
  promoteQuotationToMasterData,
  searchPromoteWizardDuplicateBrands,
  searchPromoteWizardDuplicateClients,
} from "@/features/quotations/lifecycle-actions";
import { DuplicateSuggestionPanel } from "@/features/quotations/components/duplicate-suggestion-panel";
import { OnboardingStatusBadge } from "@/features/clients/components/onboarding-status-badge";
import { DEFAULT_PROMOTED_ONBOARDING_STATUS } from "@/lib/clients/onboarding-status";
import {
  PROMOTE_WIZARD_STEPS,
  buildPromoteReviewSummary,
  canAdvancePromoteStep,
  type PromoteMasterDataInput,
  type PromoteWizardStep,
} from "@/features/quotations/promote-master-data-schema";
import type { PromoteWizardOptions, QuotationDetail } from "@/features/quotations/types";
import type { AgencyOrDirect } from "@/types/database";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<PromoteWizardStep, string> = {
  client: "Client",
  brand: "Brand",
  ownership: "Group & ownership",
  checklist: "Onboarding",
  review: "Review",
};

type Props = {
  detail: QuotationDetail;
  options: PromoteWizardOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DUPLICATE_DEBOUNCE_MS = 400;

type DuplicateSuggestion = {
  id: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  matchType: "exact" | "fuzzy" | "legal_name" | "alias" | "code";
  score: number;
  clientId?: string;
};

function stepIndex(step: PromoteWizardStep): number {
  return PROMOTE_WIZARD_STEPS.indexOf(step);
}

export function PromoteMasterDataWizard({ detail, options, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<PromoteWizardStep>("client");
  const [successOpen, setSuccessOpen] = useState(false);
  const [promotedClientId, setPromotedClientId] = useState<string | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<
    Array<{ field: string; message: string }>
  >([]);

  const [clientMode, setClientMode] = useState<"create" | "link">("create");
  const [clientName, setClientName] = useState(detail.temporary_client_name ?? "");
  const [legalName, setLegalName] = useState("");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>("agency");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [existingClientId, setExistingClientId] = useState("");

  const [brandMode, setBrandMode] = useState<"create" | "link" | "skip">("create");
  const [brandName, setBrandName] = useState(detail.temporary_brand_name ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [existingBrandId, setExistingBrandId] = useState("");

  const [groupId, setGroupId] = useState("");
  const [clientOwnerId, setClientOwnerId] = useState("");
  const [countryManagerId, setCountryManagerId] = useState("");
  const [commercialOwnerId, setCommercialOwnerId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [clientDuplicateOverride, setClientDuplicateOverride] = useState(false);
  const [brandDuplicateOverride, setBrandDuplicateOverride] = useState(false);
  const [clientDuplicateSuggestions, setClientDuplicateSuggestions] = useState<
    DuplicateSuggestion[]
  >([]);
  const [brandDuplicateSuggestions, setBrandDuplicateSuggestions] = useState<
    DuplicateSuggestion[]
  >([]);
  const [clientDuplicateLoading, setClientDuplicateLoading] = useState(false);
  const [brandDuplicateLoading, setBrandDuplicateLoading] = useState(false);
  const [clientDuplicateDismissed, setClientDuplicateDismissed] = useState(false);
  const [brandDuplicateDismissed, setBrandDuplicateDismissed] = useState(false);
  const clientDuplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandDuplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("client");
    setClientMode("create");
    setClientName(detail.temporary_client_name ?? "");
    setBrandName(detail.temporary_brand_name ?? "");
    setBrandMode(detail.temporary_brand_name ? "create" : "skip");
    setAcknowledged(false);
    setDuplicateWarnings([]);
    setClientDuplicateOverride(false);
    setBrandDuplicateOverride(false);
    setClientDuplicateSuggestions([]);
    setBrandDuplicateSuggestions([]);
    setClientDuplicateDismissed(false);
    setBrandDuplicateDismissed(false);
    setSuccessOpen(false);
  }, [open, detail.temporary_brand_name, detail.temporary_client_name]);

  useEffect(() => {
    if (!open || clientMode !== "create") return;
    if (clientDuplicateTimerRef.current) clearTimeout(clientDuplicateTimerRef.current);
    if (clientName.trim().length < 2) {
      setClientDuplicateSuggestions([]);
      return;
    }
    setClientDuplicateLoading(true);
    clientDuplicateTimerRef.current = setTimeout(() => {
      void searchPromoteWizardDuplicateClients({
        query: clientName,
        agencyOrDirect,
      }).then((res) => {
        setClientDuplicateLoading(false);
        if (res.ok && res.data) {
          setClientDuplicateSuggestions(res.data.suggestions as DuplicateSuggestion[]);
          setClientDuplicateDismissed(false);
        }
      });
    }, DUPLICATE_DEBOUNCE_MS);
    return () => {
      if (clientDuplicateTimerRef.current) clearTimeout(clientDuplicateTimerRef.current);
    };
  }, [open, clientMode, clientName, agencyOrDirect]);

  useEffect(() => {
    if (!open || brandMode !== "create") return;
    if (brandDuplicateTimerRef.current) clearTimeout(brandDuplicateTimerRef.current);
    if (brandName.trim().length < 2) {
      setBrandDuplicateSuggestions([]);
      return;
    }
    setBrandDuplicateLoading(true);
    brandDuplicateTimerRef.current = setTimeout(() => {
      void searchPromoteWizardDuplicateBrands({
        query: brandName,
        clientId: clientMode === "link" ? existingClientId || null : null,
      }).then((res) => {
        setBrandDuplicateLoading(false);
        if (res.ok && res.data) {
          setBrandDuplicateSuggestions(res.data.suggestions as DuplicateSuggestion[]);
          setBrandDuplicateDismissed(false);
        }
      });
    }, DUPLICATE_DEBOUNCE_MS);
    return () => {
      if (brandDuplicateTimerRef.current) clearTimeout(brandDuplicateTimerRef.current);
    };
  }, [open, brandMode, brandName, clientMode, existingClientId]);

  const clientOptions = useMemo(
    () =>
      options.clients.map((c) => ({
        value: c.id,
        label: c.name,
        description: [c.document_number, c.legal_name].filter(Boolean).join(" · ") || undefined,
      })),
    [options.clients]
  );

  const brandsForClient = useMemo(() => {
    const clientId = clientMode === "link" ? existingClientId : null;
    if (!clientId) return [];
    return options.brands.filter((b) => b.client_id === clientId);
  }, [brandMode, clientMode, existingClientId, options.brands]);

  const brandOptions = useMemo(
    () => brandsForClient.map((b) => ({ value: b.id, label: b.name })),
    [brandsForClient]
  );

  const subcategoryOptions = useMemo(
    () =>
      options.subcategories
        .filter((s) => !categoryId || s.category_id === categoryId)
        .map((s) => ({ value: s.id, label: s.name })),
    [categoryId, options.subcategories]
  );

  const ownerOptions = useMemo(
    () =>
      options.owners.map((o) => ({
        value: o.id,
        label: o.full_name?.trim() || o.email,
        description: o.full_name ? o.email : undefined,
      })),
    [options.owners]
  );

  const groupOptions = useMemo(
    () => options.groups.map((g) => ({ value: g.id, label: g.name })),
    [options.groups]
  );

  const draft = useMemo(
    (): Partial<Omit<PromoteMasterDataInput, "acknowledged" | "quotationId">> & {
      acknowledged?: boolean;
    } => ({
      clientMode,
      clientName,
      legalName,
      agencyOrDirect,
      industry,
      country,
      website,
      existingClientId: existingClientId || null,
      brandMode,
      brandName,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      existingBrandId: existingBrandId || null,
      groupId: groupId || null,
      clientOwnerId: clientOwnerId || null,
      countryManagerId: countryManagerId || null,
      commercialOwnerId: commercialOwnerId || null,
      acknowledged,
      clientDuplicateOverride,
      brandDuplicateOverride,
    }),
    [
      acknowledged,
      agencyOrDirect,
      brandMode,
      brandName,
      categoryId,
      clientMode,
      clientName,
      clientOwnerId,
      commercialOwnerId,
      country,
      countryManagerId,
      existingClientId,
      groupId,
      industry,
      legalName,
      subcategoryId,
      website,
      clientDuplicateOverride,
      brandDuplicateOverride,
    ]
  );

  function handleUseExistingClient(id: string) {
    setClientMode("link");
    setExistingClientId(id);
    setExistingBrandId("");
    setClientDuplicateSuggestions([]);
    setClientDuplicateDismissed(true);
  }

  function handleUseExistingBrand(id: string) {
    const match = brandDuplicateSuggestions.find((s) => s.id === id);
    if (match?.clientId) {
      setClientMode("link");
      setExistingClientId(match.clientId);
    }
    setBrandMode("link");
    setExistingBrandId(id);
    setBrandDuplicateSuggestions([]);
    setBrandDuplicateDismissed(true);
  }

  const reviewSummary = useMemo(() => {
    if (step !== "review" && !successOpen) return null;
    return buildPromoteReviewSummary({
      clientMode,
      clientName,
      brandMode,
      brandName,
      groupId: groupId || null,
      clientOwnerId: clientOwnerId || null,
      countryManagerId: countryManagerId || null,
      commercialOwnerId: commercialOwnerId || null,
    });
  }, [
    step,
    successOpen,
    clientMode,
    clientName,
    brandMode,
    brandName,
    groupId,
    clientOwnerId,
    countryManagerId,
    commercialOwnerId,
  ]);

  function refreshDuplicateWarnings(
    nextDraft: Partial<Omit<PromoteMasterDataInput, "acknowledged" | "quotationId">> & {
      acknowledged?: boolean;
    }
  ) {
    void checkPromoteMasterDataDuplicateWarnings({
      clientMode: nextDraft.clientMode ?? "create",
      clientName: nextDraft.clientName ?? null,
      legalName: nextDraft.legalName ?? null,
      agencyOrDirect: nextDraft.agencyOrDirect ?? "agency",
      industry: nextDraft.industry ?? null,
      country: nextDraft.country ?? null,
      website: nextDraft.website ?? null,
      existingClientId: nextDraft.existingClientId ?? null,
      brandMode: nextDraft.brandMode ?? "skip",
      brandName: nextDraft.brandName ?? null,
      categoryId: nextDraft.categoryId ?? null,
      subcategoryId: nextDraft.subcategoryId ?? null,
      existingBrandId: nextDraft.existingBrandId ?? null,
      groupId: nextDraft.groupId ?? null,
      clientOwnerId: nextDraft.clientOwnerId ?? null,
      countryManagerId: nextDraft.countryManagerId ?? null,
      commercialOwnerId: nextDraft.commercialOwnerId ?? null,
      clientDuplicateOverride: nextDraft.clientDuplicateOverride ?? false,
      brandDuplicateOverride: nextDraft.brandDuplicateOverride ?? false,
    }).then((res) => {
      if (res.ok && res.data) setDuplicateWarnings(res.data.warnings);
    });
  }

  function goNext() {
    const gate = canAdvancePromoteStep(step, draft);
    if (!gate.ok) {
      toast.error(gate.message);
      return;
    }
    const idx = stepIndex(step);
    if (idx < PROMOTE_WIZARD_STEPS.length - 1) {
      const nextStep = PROMOTE_WIZARD_STEPS[idx + 1];
      setStep(nextStep);
      if (nextStep === "review") refreshDuplicateWarnings(draft);
    }
  }

  function goBack() {
    const idx = stepIndex(step);
    if (idx > 0) setStep(PROMOTE_WIZARD_STEPS[idx - 1]);
  }

  function handlePromote() {
    const gate = canAdvancePromoteStep("checklist", draft);
    if (!gate.ok) {
      toast.error(gate.message);
      return;
    }

    startTransition(async () => {
      const payload: PromoteMasterDataInput = {
        quotationId: detail.id,
        clientMode,
        clientName: clientName || null,
        legalName: legalName || null,
        agencyOrDirect,
        industry: industry || null,
        country: country || null,
        website: website || null,
        existingClientId: existingClientId || null,
        brandMode,
        brandName: brandName || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        existingBrandId: existingBrandId || null,
        groupId: groupId || null,
        clientOwnerId: clientOwnerId || null,
        countryManagerId: countryManagerId || null,
        commercialOwnerId: commercialOwnerId || null,
        acknowledged: true,
        clientDuplicateOverride,
        brandDuplicateOverride,
      };

      const res = await promoteQuotationToMasterData(payload);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setPromotedClientId(res.data?.clientId ?? null);
      onOpenChange(false);
      setSuccessOpen(true);
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(96vw,960px)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Promote to master data</DialogTitle>
            <DialogDescription>
              Onboard temporary quotation client/brand into Thinkway master data with audit trail.
            </DialogDescription>
            <ol className="mt-4 flex flex-wrap gap-2" aria-label="Wizard steps">
              {PROMOTE_WIZARD_STEPS.map((key, index) => {
                const active = key === step;
                const done = stepIndex(step) > index;
                return (
                  <li key={key}>
                    <Badge
                      variant={active ? "default" : done ? "secondary" : "outline"}
                      className="text-[10px] font-medium"
                    >
                      {index + 1}. {STEP_LABELS[key]}
                    </Badge>
                  </li>
                );
              })}
            </ol>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step === "client" ? (
              <div className="space-y-4">
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                  {(["create", "link"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                        clientMode === mode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      )}
                      onClick={() => setClientMode(mode)}
                    >
                      {mode === "create" ? "Create new client" : "Link existing"}
                    </button>
                  ))}
                </div>

                {clientMode === "create" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Client name (required)</Label>
                      <Input
                        value={clientName}
                        onChange={(e) => {
                          setClientName(e.target.value);
                          setClientDuplicateDismissed(false);
                          setClientDuplicateOverride(false);
                        }}
                        placeholder="e.g. L'Oreal Middle East"
                        aria-autocomplete="list"
                      />
                    </div>
                    <DuplicateSuggestionPanel
                      entityLabel="legal entity"
                      query={clientName}
                      loading={clientDuplicateLoading}
                      suggestions={clientDuplicateSuggestions}
                      dismissed={clientDuplicateDismissed}
                      onUseExisting={handleUseExistingClient}
                      onContinueCreating={() => {
                        setClientDuplicateDismissed(true);
                        setClientDuplicateOverride(true);
                      }}
                      className="md:col-span-2"
                    />
                    <div className="space-y-1.5">
                      <Label>Legal entity name</Label>
                      <Input
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        placeholder="Optional registered name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Client type</Label>
                      <Select
                        value={agencyOrDirect}
                        onValueChange={(v) => setAgencyOrDirect(v as AgencyOrDirect)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Industry</Label>
                      <SearchableSelect
                        value={industry}
                        onValueChange={setIndustry}
                        options={[
                          { value: "", label: "Select industry…" },
                          ...CLIENT_INDUSTRY_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                          })),
                        ]}
                        placeholder="Industry"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <SearchableSelect
                        value={country}
                        onValueChange={setCountry}
                        options={[
                          { value: "", label: "Select country…" },
                          ...COUNTRY_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                          })),
                        ]}
                        placeholder="Country"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Website</Label>
                      <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                    <p className="md:col-span-2 text-xs text-muted-foreground">
                      New legal entities are created in <strong>Draft (prospect)</strong> status with{" "}
                      <strong>Legal pending</strong> onboarding until finance approval completes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Search legal entity</Label>
                    <SearchableSelect
                      value={existingClientId}
                      onValueChange={(id) => {
                        setExistingClientId(id);
                        setExistingBrandId("");
                      }}
                      options={[{ value: "", label: "Select client…" }, ...clientOptions]}
                      placeholder="Search by name, legal entity, or code"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {step === "brand" ? (
              <div className="space-y-4">
                <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted/30 p-0.5">
                  {(clientMode === "create"
                    ? (["create", "skip"] as const)
                    : (["link", "create"] as const)
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium",
                        brandMode === mode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      )}
                      onClick={() => setBrandMode(mode)}
                    >
                      {mode === "create"
                        ? "Create new brand"
                        : mode === "link"
                          ? "Select existing brand"
                          : "Skip for now"}
                    </button>
                  ))}
                </div>

                {brandMode === "create" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Brand name</Label>
                      <Input
                        value={brandName}
                        onChange={(e) => {
                          setBrandName(e.target.value);
                          setBrandDuplicateDismissed(false);
                          setBrandDuplicateOverride(false);
                        }}
                        placeholder="Brand name"
                        aria-autocomplete="list"
                      />
                    </div>
                    <DuplicateSuggestionPanel
                      entityLabel="brand"
                      query={brandName}
                      loading={brandDuplicateLoading}
                      suggestions={brandDuplicateSuggestions}
                      dismissed={brandDuplicateDismissed}
                      onUseExisting={handleUseExistingBrand}
                      onContinueCreating={() => {
                        setBrandDuplicateDismissed(true);
                        setBrandDuplicateOverride(true);
                      }}
                      className="md:col-span-2"
                    />
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <SearchableSelect
                        value={categoryId}
                        onValueChange={(v) => {
                          setCategoryId(v);
                          setSubcategoryId("");
                        }}
                        options={[
                          { value: "", label: "Select category…" },
                          ...options.categories.map((c) => ({
                            value: c.id,
                            label: c.name,
                          })),
                        ]}
                        placeholder="Category"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Subcategory</Label>
                      <SearchableSelect
                        value={subcategoryId}
                        onValueChange={setSubcategoryId}
                        options={[{ value: "", label: "Select subcategory…" }, ...subcategoryOptions]}
                        disabled={!categoryId}
                        placeholder={categoryId ? "Subcategory" : "Select category first"}
                      />
                    </div>
                    {clientMode === "create" ? (
                      <p className="md:col-span-2 text-xs text-muted-foreground">
                        Group assignment is optional. Brand status remains{" "}
                        <strong>Draft (prospect)</strong> until onboarding completes.
                      </p>
                    ) : null}
                  </div>
                ) : brandMode === "link" ? (
                  <div className="space-y-2">
                    <Label>Brand under selected client</Label>
                    <SearchableSelect
                      value={existingBrandId}
                      onValueChange={setExistingBrandId}
                      options={[{ value: "", label: "Select brand…" }, ...brandOptions]}
                      disabled={!existingClientId}
                      placeholder={
                        existingClientId ? "Select brand" : "Select a legal entity in step 1"
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Quotation will link to the legal entity only. You can add a brand later from the
                    client profile.
                  </p>
                )}
              </div>
            ) : null}

            {step === "ownership" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Group (optional)</Label>
                  <SearchableSelect
                    value={groupId}
                    onValueChange={setGroupId}
                    options={[{ value: "", label: "No group" }, ...groupOptions]}
                    placeholder="WPP, Publicis, etc."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Client owner</Label>
                  <SearchableSelect
                    value={clientOwnerId}
                    onValueChange={setClientOwnerId}
                    options={[{ value: "", label: "Unassigned" }, ...ownerOptions]}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Country manager</Label>
                  <SearchableSelect
                    value={countryManagerId}
                    onValueChange={setCountryManagerId}
                    options={[{ value: "", label: "Unassigned" }, ...ownerOptions]}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Commercial owner</Label>
                  <SearchableSelect
                    value={commercialOwnerId}
                    onValueChange={setCommercialOwnerId}
                    options={[{ value: "", label: "Unassigned" }, ...ownerOptions]}
                    placeholder="Optional — stored as account manager"
                  />
                </div>
              </div>
            ) : null}

            {step === "checklist" ? (
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Promoting creates or links master data records. Complete legal onboarding, contracts,
                  VAT registration, and account manager assignment before activating the client for
                  campaigns.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Trade license and VAT documents must be collected in client legal tab.</li>
                  <li>• Finance approval assigns the permanent client code (C-XXX).</li>
                  <li>• Campaign creation requires an active brand when applicable.</li>
                </ul>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                  <Checkbox
                    id="promote-ack"
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(Boolean(v))}
                  />
                  <Label htmlFor="promote-ack" className="text-sm font-normal leading-snug">
                    I understand that promoted records remain in draft (prospect) status until full
                    client onboarding and finance approval are complete.
                  </Label>
                </div>
              </div>
            ) : null}

            {step === "review" ? (
              <div className="space-y-4">
                {duplicateWarnings.length > 0 ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <p className="font-medium text-warning">Possible duplicates detected</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {duplicateWarnings.map((w) => (
                        <li key={`${w.field}-${w.message}`}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {reviewSummary ? (
                  <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Scenario
                      </dt>
                      <dd>{reviewSummary.caseLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Status
                      </dt>
                      <dd className="flex flex-wrap items-center gap-2">
                        <span>{reviewSummary.statusLabel}</span>
                        <OnboardingStatusBadge status={DEFAULT_PROMOTED_ONBOARDING_STATUS} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Onboarding
                      </dt>
                      <dd>{reviewSummary.onboardingStatusLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Legal entity
                      </dt>
                      <dd>{reviewSummary.clientLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Brand
                      </dt>
                      <dd>{reviewSummary.brandLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Group
                      </dt>
                      <dd>
                        {groupId
                          ? options.groups.find((g) => g.id === groupId)?.name ?? "Selected"
                          : "None"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Ownership
                      </dt>
                      <dd>{reviewSummary.ownersLabel}</dd>
                    </div>
                  </dl>
                ) : null}
                {detail.temporary_client_name || detail.temporary_brand_name ? (
                  <p className="text-xs text-muted-foreground">
                    Temporary values: {detail.temporary_client_name ?? "—"} /{" "}
                    {detail.temporary_brand_name ?? "—"} will be cleared after promotion.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {step !== "client" ? (
                <Button type="button" variant="outline" onClick={goBack} disabled={pending}>
                  <ChevronLeftIcon className="size-4" data-icon="inline-start" />
                  Back
                </Button>
              ) : null}
            </div>
            {step === "review" ? (
              <Button type="button" disabled={pending} onClick={handlePromote}>
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Promote to master data
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={pending}>
                Next
                <ChevronRightIcon className="size-4" data-icon="inline-end" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-primary" />
              Promoted to master data
            </DialogTitle>
            <DialogDescription>
              Master data is linked to this quotation. Complete onboarding before campaigns.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>1. Upload trade license, VAT certificate, and signed contract in client legal tab.</li>
            <li>2. Submit client profile for finance approval to receive client code.</li>
            <li>3. Assign account manager and activate brand when ready.</li>
          </ul>
          <DialogFooter className="gap-2 sm:justify-start">
            {promotedClientId ? (
              <Button asChild variant="default">
                <Link href={`/clients/${promotedClientId}`}>Open legal entity</Link>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setSuccessOpen(false)}>
              Continue in quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
