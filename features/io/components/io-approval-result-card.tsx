import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getIoApprovalOutcomeView,
  type IoApprovalOutcomeCode,
} from "@/lib/io/io-approval-outcomes";

const TONE_CLASS: Record<
  ReturnType<typeof getIoApprovalOutcomeView>["tone"],
  string
> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
  danger:
    "border-destructive/30 bg-destructive/10 text-destructive",
};

type Props = {
  kindLabel: "Client IO" | "Vendor IO";
  outcome: IoApprovalOutcomeCode;
  documentNumber?: string | null;
};

export function IoApprovalResultCard({
  kindLabel,
  outcome,
  documentNumber,
}: Props) {
  const view = getIoApprovalOutcomeView(outcome);

  return (
    <main className="mx-auto max-w-lg space-y-4 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>{kindLabel} Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className={`rounded-lg border p-4 ${TONE_CLASS[view.tone]}`}>
            <p className="font-medium">{view.title}</p>
            <p className="mt-2">{view.body}</p>
            {documentNumber ? (
              <p className="mt-3 text-muted-foreground">
                Document reference: {documentNumber}
              </p>
            ) : null}
            {outcome === "approved" ? (
              <p className="mt-2 text-muted-foreground">
                A confirmation email has been sent with the approved PDF attached.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
