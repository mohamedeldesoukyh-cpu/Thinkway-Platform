"use client";

import { ShortlistCreatorPicker } from "@/features/creators/picker/shortlist-creator-picker";
import type { ExistingCreatorKey } from "@/features/creators/picker/creator-selection-types";

export function AddCreatorsDrawer({
  open,
  onOpenChange,
  shortlistId,
  existingItems,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  existingItems: ExistingCreatorKey[];
  onAdded: () => void;
}) {
  return (
    <ShortlistCreatorPicker
      open={open}
      onOpenChange={onOpenChange}
      shortlistId={shortlistId}
      existingItems={existingItems}
      onAdded={onAdded}
    />
  );
}
