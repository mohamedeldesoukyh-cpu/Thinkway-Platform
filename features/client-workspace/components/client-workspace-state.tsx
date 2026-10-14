"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import type { ClientCreatorSelectionState, ClientWorkspaceSectionId } from "../constants";
import { projectSelectionSummaryFromCards } from "../media-plan-summary";
import { isPricedClientInvestment, hydrateClientSelection, selectionCalculator } from "../selection-flow";
import { acceptedCreators, selectionMapFromView } from "../selection-view";
import type { ClientCommercialSummary, ClientMediaPlanSummary, ClientWorkspaceView } from "../types";

import { applyCreatorQuotationOptions, validateQuotationOptionChoice } from "../quotation-options";
import { createOptionSaveQueue } from "../option-save-queue";
import { selectQuotationOptionsAction } from "../actions/client-workspace-actions";

type ClientWorkspaceState = {
  view: ClientWorkspaceView;
  token: string;
  selection: Record<string, ClientCreatorSelectionState>;
  optionsSaving: boolean;
  optionErrors: Record<string, string | undefined>;
  saveOptions: (creator: ClientWorkspaceView["creators"][number], itemIds: string[]) => void;
  setOptionCreator: (creator: ClientWorkspaceView["creators"][number]) => void;
  setCreatorState: (creatorId: string, state: ClientCreatorSelectionState) => void;
  setCreatorStates: (next: Record<string, ClientCreatorSelectionState>) => void;
  goToSection: (section: ClientWorkspaceSectionId) => void;
  selectedCreators: ClientWorkspaceView["creators"];
  selectedSummary: ClientMediaPlanSummary;
  selectedCommercial: ClientCommercialSummary;
};

const ClientWorkspaceStateContext = createContext<ClientWorkspaceState | null>(null);

export function ClientWorkspaceStateProvider({
  view: sourceView,
  token,
  onSectionChange,
  children,
}: {
  view: ClientWorkspaceView;
  token: string;
  onSectionChange: (section: ClientWorkspaceSectionId) => void;
  children: ReactNode;
}) {
  const [optionCreators, setOptionCreators] = useState<{ source: ClientWorkspaceView; creators: Record<string, ClientWorkspaceView["creators"][number]> }>({ source: sourceView, creators: {} });
  const view = useMemo(() => ({ ...sourceView, creators: sourceView.creators.map(creator => (optionCreators.source === sourceView ? optionCreators.creators[creator.creatorId] : undefined) ?? creator) }), [sourceView, optionCreators]);
  const setOptionCreator = useCallback((creator: ClientWorkspaceView["creators"][number]) => setOptionCreators(current => ({ source: sourceView, creators: { ...(current.source === sourceView ? current.creators : {}), [creator.creatorId]: creator } })), [sourceView]);
  const pendingIds = view.journey?.pendingCommercialApprovalCreatorIds ?? [];
  const lockedIds = (view.journey?.clientApprovedCreatorIds ?? []).filter(
    (id) => !pendingIds.includes(id)
  );
  const [selection, setSelection] = useState(() =>
    hydrateClientSelection(view.creators, selectionMapFromView(view), lockedIds, pendingIds)
  );
  const setCreatorState = useCallback((creatorId: string, state: ClientCreatorSelectionState) => {
    setSelection((current) => ({ ...current, [creatorId]: state }));
  }, []);
  const setCreatorStates = useCallback((next: Record<string, ClientCreatorSelectionState>) => {
    setSelection((current) => ({ ...current, ...next }));
  }, []);
  const [saveQueue] = useState(createOptionSaveQueue);
  const [optionSaveCount, setOptionSaveCount] = useState(0);
  const [optionErrors, setOptionErrors] = useState<Record<string, string | undefined>>({});
  const savedOptions = useRef(new Map<string, ClientWorkspaceView["creators"][number]>());
  const saveOptions = useCallback((creator: ClientWorkspaceView["creators"][number], itemIds: string[]) => {
    if (!validateQuotationOptionChoice(creator, itemIds)) return;
    const key = creator.creatorId;
    if (!savedOptions.current.has(key)) savedOptions.current.set(key, creator);
    const state: ClientCreatorSelectionState = itemIds.length ? "accepted" : "in_review";
    setOptionCreator(applyCreatorQuotationOptions({ ...creator, selectedQuotationItemIds: itemIds, selection: state }));
    setCreatorState(key, state);
    setOptionErrors(errors => ({ ...errors, [key]: undefined }));
    setOptionSaveCount(count => count + 1);
    void saveQueue.enqueue(key, async isLatest => {
      try {
        const result = await selectQuotationOptionsAction({ token, creatorId: key, itemIds });
        if (!result.ok || !("creator" in result) || !result.creator) throw new Error(result.message);
        const saved = { ...creator, ...result.creator, selection: state };
        savedOptions.current.set(key, saved);
        if (isLatest()) {
          setOptionCreator(saved);
          // Other creators may have newer optimistic choices: never overwrite them.
          setCreatorState(key, state);
        }
      } catch (error) {
        if (isLatest()) {
          const saved = savedOptions.current.get(key)!;
          setOptionCreator(saved);
          setCreatorState(key, saved.selection);
          setOptionErrors(errors => ({ ...errors, [key]: error instanceof Error ? error.message : "Options could not be saved. Please try again." }));
        }
      } finally {
        if (isLatest()) savedOptions.current.delete(key);
      }
    }).finally(() => setOptionSaveCount(count => count - 1));
  }, [token, saveQueue, setOptionCreator, setCreatorState]);
  const value = useMemo((): ClientWorkspaceState => {
    const pendingIds = view.journey?.pendingCommercialApprovalCreatorIds ?? [];
    const lockedIds = (view.journey?.clientApprovedCreatorIds ?? []).filter(
      (id) => !pendingIds.includes(id)
    );
    const effectiveSelection = hydrateClientSelection(view.creators, selection, lockedIds);
    const selectedCreators = acceptedCreators(
      view.creators,
      effectiveSelection,
      view.journey?.clientApprovedCreatorIds
    );
    const selectedSummary = projectSelectionSummaryFromCards(
      view.creators,
      effectiveSelection,
      view.commercial.currency
    );
    const calc = selectionCalculator(view.creators, effectiveSelection);
    const selectedCommercial: ClientCommercialSummary = {
      ...view.commercial,
      feeAmount: calc.agencyFees,
      creatorInvestment: calc.pricedInvestment,
      totalInvestment: calc.totalInvestment,
      selectedCount: calc.selectedCount,
      pricedSelectedCount: calc.pricedSelectedCount,
      unpricedSelectedCount: calc.unpricedSelectedCount,
      lines: selectedCreators
        .filter((creator) => isPricedClientInvestment(creator.investmentAmount))
        .map((creator) => ({ label: creator.displayName, amount: creator.investmentAmount })),
    };
    return {
      view,
      token,
      selection: effectiveSelection,
      setOptionCreator,
      optionsSaving: optionSaveCount > 0,
      optionErrors,
      saveOptions,
      setCreatorState,
      setCreatorStates,
      goToSection: onSectionChange,
      selectedCreators,
      selectedSummary,
      selectedCommercial,
    };
  }, [
    onSectionChange,
    optionSaveCount,
    optionErrors,
    saveOptions,
    selection,
    setOptionCreator,
    setCreatorState,
    setCreatorStates,
    token,
    view,
  ]);

  return (
    <ClientWorkspaceStateContext.Provider value={value}>{children}</ClientWorkspaceStateContext.Provider>
  );
}

export function useClientWorkspaceState(): ClientWorkspaceState {
  const value = useContext(ClientWorkspaceStateContext);
  if (!value) {
    throw new Error("useClientWorkspaceState must be used inside ClientWorkspaceStateProvider");
  }
  return value;
}
