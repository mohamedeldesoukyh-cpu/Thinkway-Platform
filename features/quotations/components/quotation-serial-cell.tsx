import { cn } from "@/lib/utils";
import { quotationSerialIconColor } from "@/lib/quotations/quotation-serial-color";

type Props = {
  quotationId: string;
  serialNumber: string | null;
  className?: string;
};

export function QuotationSerialCell({ quotationId, serialNumber, className }: Props) {
  const color = quotationSerialIconColor(quotationId);

  return (
    <div className={cn("flex min-w-0 items-center gap-[9px]", className)}>
      <span
        className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold text-white"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        Q
      </span>
      <span className="font-mono text-[11.5px] font-bold tabular-nums text-[var(--text)] dark:text-foreground">
        {serialNumber ?? "—"}
      </span>
    </div>
  );
}
