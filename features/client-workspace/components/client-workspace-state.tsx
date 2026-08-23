"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { ClientCreatorSelectionState, ClientWorkspaceSectionId } from "../constants";
import { projectSelectionSummaryFromCards } from "../media-plan-summary";
import { isPricedClientInvestment, hydrateClientSelection, selectionCalculator } from "../selection-flow";
import { acceptedCreators, selectionMapFromView } from "../selection-view";
import { SHOW_ORIGINAL_CURRENCY_DEFAULT } from "../quotation-client-facing";
import type { ClientCommercialSummary, ClientMediaPlanSummary, ClientWorkspaceView } from "../types";

type ClientWorkspaceState = {
  view: ClientWorkspaceView;
  token: string;
  selection: Record<string, ClientCreatorSelectionState>;
  setCreatorState: (creatorId: string, state: ClientCreatorSelectionState) => void;
  setCreatorStates: (next: Record<string, ClientCreatorSelectionState>) => void;
  goToSection: (section: ClientWorkspaceSectionId) => void;
  selectedCreators: ClientWorkspaceView["creators"];
  selectedSummary: ClientMediaPlanSummary;
  selectedCommercial: ClientCommercialSummary;
  showOriginalCurrency: boolean;
  setShowOriginalCurrency: (next: boolean) => void;
};

const ClientWorkspaceStateContext = createContext<ClientWorkspaceState | null>(null);

export function ClientWorkspaceStateProvider({
  view,
  token,
  onSectionChange,
  children,
}: {
  view: ClientWorkspaceView;
  token: string;
  onSectionChange: (section: ClientWorkspaceSectionId) => void;
  children: ReactNode;
}) {
  const pendingIds = view.journey?.pendingCommercialApprovalCreatorIds ?? [];
  const lockedIds = (view.journey?.clientApprovedCreatorIds ?? []).filter(
    (id) => !pendingIds.includes(id)
  );
  const [selection, setSelection] = useState(() =>
    hydrateClientSelection(view.creators, selectionMapFromView(view), lockedIds, pendingIds)
  );
  const [showOriginalCurrency, setShowOriginalCurrency] = useState(SHOW_ORIGINAL_CURRENCY_DEFAULT);
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
      setCreatorState,
      setCreatorStates,
      goToSection: onSectionChange,
      selectedCreators,
      selectedSummary,
      selectedCommercial,
      showOriginalCurrency,
      setShowOriginalCurrency,
    };
  }, [
    onSectionChange,
    selection,
    setCreatorState,
    setCreatorStates,
    showOriginalCurrency,
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
