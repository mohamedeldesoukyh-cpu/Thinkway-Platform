import { UploadIcon } from "lucide-react";

export function ImportCenterHero() {
  return (
    <section className="border-b border-border bg-background px-6 py-5 md:px-7">
      <div className="flex items-start gap-3.5">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 dark:bg-emerald-950/40"
          aria-hidden
        >
          <UploadIcon className="size-5 text-emerald-500 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Discovery Import Center
          </h1>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Upload creator datasets from agencies, platforms, or clients.
          </p>
        </div>
      </div>
    </section>
  );
}
