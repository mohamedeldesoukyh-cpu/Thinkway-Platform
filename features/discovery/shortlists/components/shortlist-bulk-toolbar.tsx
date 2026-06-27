"use client";

import {
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo } from "react";

import {
  GlassSelectionFlyout,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";

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
  onMoveSelected: () => void;
  onGenerateQuotation: () => void;
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
  onMoveSelected,
  onGenerateQuotation,
  onApproveSelected,
  onRejectSelected,
  onCancelSelected,
  onClearSelection,
}: Props) {
  const actions = useMemo(() => {
    const list: GlassFlyoutAction[] = [];

    if (showSubmit) {
      list.push({
        id: "submit",
        label: "Submit selected",
        icon: SendIcon,
        variant: "primary",
        disabled: busy,
        onClick: onSubmitSelected,
      });
    }

    if (showStatusActions) {
      list.push(
        {
          id: "approve",
          label: "Approve",
          icon: CheckIcon,
          variant: "primary",
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
    }

    list.push(
      {
        id: "remove",
        label: "Remove",
        icon: Trash2Icon,
        variant: "outline",
        destructive: true,
        disabled: busy,
        onClick: onRemoveSelected,
      },
      {
        id: "compare",
        label: "Compare",
        icon: GitCompareArrowsIcon,
        variant: "outline",
        disabled: busy,
        onClick: onCompareSelected,
      },
      {
        id: "export",
        label: "Export",
        icon: DownloadIcon,
        variant: "outline",
        disabled: busy,
        onClick: onExportSelected,
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

    list.push(
      {
        id: "quotation",
        label: "Generate quotation",
        icon: FileTextIcon,
        variant: "outline",
        disabled: busy,
        onClick: onGenerateQuotation,
      },
      {
        id: "cancel",
        label: "Cancel selected",
        variant: "outline",
        disabled: busy,
        onClick: onCancelSelected,
      }
    );

    return list;
  }, [
    showSubmit,
    showStatusActions,
    showMove,
    busy,
    onSubmitSelected,
    onRemoveSelected,
    onCompareSelected,
    onExportSelected,
    onMoveSelected,
    onGenerateQuotation,
    onApproveSelected,
    onRejectSelected,
    onCancelSelected,
  ]);

  return (
    <GlassSelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={3}
    />
  );
}
