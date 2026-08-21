import Link from "next/link";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { Button } from "@/components/ui/button";

export default function QuotationNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Quotation not found</h2>
        <p className="text-sm text-muted-foreground">
          This quotation may still be opening, or the link is not a valid quotation number.
          Open Client Quotations and select it from the list.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/discovery/quotations">Open quotations</Link>
        </Button>
        <PageBackButton fallbackHref="/discovery/quotations" label="Back" />
      </div>
    </div>
  );
}
