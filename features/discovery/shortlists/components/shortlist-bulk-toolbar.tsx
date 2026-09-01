"use client";

import {
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  Layers2Icon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  UnfoldVerticalIcon,
} from "lucide-react";
import { useMemo } from "react";

import {
  DiscoverySelectionFlyout,
  type DiscoverySelectionFlyoutAction,
} from "@/features/discovery/components/design-system";

type Props = {
  selectedCount: number;
  showSubmit: boolean;
  showStatusActions: boolean;
  showMove: boolean;
  busy?: boolean;
  onSubmitSelected: () => void;
  onRemoveSelected: () => void;
  onCompareSelected: () => void;
  onExportSelected: () => void;
  onRefreshMetrics?: () => void;
  onMoveSelected: () => void;
  onGenerateNewQuotation: () => void;
  onAddToQuotation: () => void;
  onSendToClient?: () => void;
  existingQuotationLabel?: string | null;
  onCollapseSelected?: () => void;
  showCollapse?: boolean;
  onUncollapseSelected?: () => void;
  showUncollapse?: boolean;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onCancelSelected: () => void;
  onClearSelection: () => void;
};

export function ShortlistBulkToolbar({
  selectedCount,
  showSubmit,
  showStatusActions,
  showMove,
  busy,
  onSubmitSelected,
  onRemoveSelected,
  onCompareSelected,
  onExportSelected,
  onRefreshMetrics,
  onMoveSelected,
  onGenerateNewQuotation,
  onAddToQuotation,
  onSendToClient,
  existingQuotationLabel,
  onCollapseSelected,
  showCollapse,
  onUncollapseSelected,
  showUncollapse,
  onApproveSelected,
  onRejectSelected,
  onCancelSelected,
  onClearSelection,
}: Props) {
  const actions = useMemo(() => {
    const list: DiscoverySelectionFlyoutAction[] = [];

    if (showSubmit) {
      list.push({
        id: "submit",
        label: `Submit ${selectedCount} selected`,
        icon: SendIcon,
        variant: "primary",
        disabled: busy,
        onClick: onSubmitSelected,
      });
    } else if (showStatusActions) {
      list.push({
        id: "approve",
        label: "Approve",
        icon: CheckIcon,
        variant: "primary",
        disabled: busy,
        onClick: onApproveSelected,
      });
    }

    list.push(
      {
        id: "compare",
        label: "Compare",
        icon: GitCompareArrowsIcon,
        variant: "outline",
        disabled: busy,
        onClick: onCompareSelected,
      },
      {
        id: "refresh-metrics",
        label: "Refresh metrics",
        icon: RefreshCwIcon,
        variant: "outline",
        disabled: busy || !onRefreshMetrics,
        onClick: () => onRefreshMetrics?.(),
      },
      {
        id: "export",
        label: "Export CSV",
        icon: DownloadIcon,
        variant: "outline",
        disabled: busy,
        onClick: onExportSelected,
      },
      {
        id: "quotation",
        label: "Generate quotation",
        icon: FileTextIcon,
        variant: showSubmit || showStatusActions ? "outline" : "primary",
        disabled: busy,
        onClick: onGenerateNewQuotation,
        items: [
          {
            id: "quotation-new",
            label: "Generate new",
            description: "Create a new quotation with the selected creators",
            onClick: onGenerateNewQuotation,
            disabled: busy,
          },
          {
            id: "quotation-add",
            label: "Add to quotation",
            description: existingQuotationLabel
              ? `Add selected creators to ${existingQuotationLabel}`
              : "Add to the linked quotation, or create one if none exists",
            onClick: onAddToQuotation,
            disabled: busy,
          },
        ],
      }
    );

    if (showStatusActions && showSubmit) {
      list.push(
        {
          id: "approve",
          label: "Approve",
          icon: CheckIcon,
          variant: "outline",
          disabled: busy,
          onClick: onApproveSelected,
        },
        {
          id: "reject",
          label: "Reject",
          variant: "outline",
          disabled: busy,
          onClick: onRejectSelected,
        }
      );
    } else if (showStatusActions) {
      list.push({
        id: "reject",
        label: "Reject",
        variant: "outline",
        disabled: busy,
        onClick: onRejectSelected,
      });
    }

    if (showCollapse) {
      list.push({
        id: "collapse",
        label: "Collapse",
        icon: Layers2Icon,
        variant: "outline",
        disabled: busy || !onCollapseSelected,
        onClick: () => onCollapseSelected?.(),
      });
    }

    if (showUncollapse) {
      list.push({
        id: "uncollapse",
        label: "Uncollapse",
        icon: UnfoldVerticalIcon,
        variant: "outline",
        disabled: busy || !onUncollapseSelected,
        onClick: () => onUncollapseSelected?.(),
      });
    }

    list.push(
      {
        id: "send-client",
        label: "Send to Client",
        icon: SendIcon,
        variant: "outline",
        disabled: busy || !onSendToClient,
        onClick: () => onSendToClient?.(),
      },
      {
        id: "remove",
        label: "Remove",
        icon: Trash2Icon,
        variant: "outline",
        destructive: true,
        disabled: busy,
        onClick: onRemoveSelected,
      }
    );

    if (showMove) {
      list.push({
        id: "move",
        label: "Move to campaign",
        variant: "outline",
        disabled: busy,
        onClick: onMoveSelected,
      });
    }

    list.push({
      id: "cancel",
      label: "Cancel selected",
      variant: "outline",
      disabled: busy,
      onClick: onCancelSelected,
    });

    return list;
  }, [
    selectedCount,
    showSubmit,
    showStatusActions,
    showMove,
    busy,
    onSubmitSelected,
    onRemoveSelected,
    onCompareSelected,
    onExportSelected,
    onRefreshMetrics,
    onMoveSelected,
    onGenerateNewQuotation,
    onAddToQuotation,
    onSendToClient,
    existingQuotationLabel,
    onCollapseSelected,
    showCollapse,
    onUncollapseSelected,
    showUncollapse,
    onApproveSelected,
    onRejectSelected,
    onCancelSelected,
  ]);

  return (
    <DiscoverySelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={5}
    />
  );
}
