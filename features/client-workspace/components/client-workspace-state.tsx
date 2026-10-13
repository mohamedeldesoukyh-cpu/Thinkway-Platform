"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { ClientCreatorSelectionState, ClientWorkspaceSectionId } from "../constants";
import { projectSelectionSummaryFromCards } from "../media-plan-summary";
import { isPricedClientInvestment, hydrateClientSelection, selectionCalculator } from "../selection-flow";
import { acceptedCreators, selectionMapFromView } from "../selection-view";
import type { ClientCommercialSummary, ClientMediaPlanSummary, ClientWorkspaceView } from "../types";

type ClientWorkspaceState = {
  view: ClientWorkspaceView;
  token: string;
  selection: Record<string, ClientCreatorSelectionState>;
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
      setCreatorState,
      setCreatorStates,
      goToSection: onSectionChange,
      selectedCreators,
      selectedSummary,
      selectedCommercial,
    };
  }, [
    onSectionChange,
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
