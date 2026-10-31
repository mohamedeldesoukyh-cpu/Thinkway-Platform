import { cn } from "@/lib/utils";
import { QuotationText } from "./quotation-design-locale";

import {
  QUOTATION_CLIENT_SELECTION_LABEL,
} from "@/features/quotations/quotation-client-review";
import type { ClientCreatorSelectionState } from "@/features/client-workspace/constants";

export function QuotationClientReviewStatusBadge({
  state,
}: {
  state: ClientCreatorSelectionState;
}) {
  return (
    <span
      className={cn(
        "ml-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        state === "accepted" && "bg-emerald-100 text-emerald-800",
        state === "rejected" && "bg-red-100 text-red-800",
        state === "in_review" && "bg-amber-100 text-amber-800"
      )}
    >
      <QuotationText>{QUOTATION_CLIENT_SELECTION_LABEL[state]}</QuotationText>
    </span>
  );
}
