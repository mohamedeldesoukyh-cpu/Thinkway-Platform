"use client";

type AssignmentsTabErrorFallbackProps = {
  errorMessage?: string;
  digest?: string;
};

/** Minimal error UI when Assignments tab render fails — no emergency data dump. */
export function AssignmentsTabErrorFallback({
  errorMessage,
  digest,
}: AssignmentsTabErrorFallbackProps) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <p className="text-sm font-medium text-destructive">Assignments could not render</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {errorMessage ??
          "An unexpected error occurred. Refresh the page or contact support if this persists."}
      </p>
      {digest ? (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">Reference: {digest}</p>
      ) : null}
    </div>
  );
}
