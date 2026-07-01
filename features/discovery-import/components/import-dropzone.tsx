"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { uploadCreatorImportFileAction } from "@/features/discovery-import/actions";
import { CREATOR_IMPORT_UPLOAD_CONCURRENCY } from "@/lib/discovery-import/constants";
import { CREATOR_IMPORT_FILE_EXTENSIONS } from "@/features/discovery-import/types";
import type { CreatorImportUploadProgressItem } from "@/features/discovery-import/types";
import { cn } from "@/lib/utils";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "application/csv": [".csv"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

type ImportDropzoneProps = {
  onUploadComplete?: () => void | Promise<void>;
};

function resolveProgressStatusText(item: CreatorImportUploadProgressItem): string {
  if (item.status === "uploading") return "Uploading…";
  if (item.status === "pending") return "Waiting…";
  if (item.status === "success") {
    return item.message ?? "File uploaded. Queued for processing.";
  }
  return item.message ?? "Upload failed";
}

export function ImportDropzone({ onUploadComplete }: ImportDropzoneProps) {
  const [sourceName, setSourceName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<CreatorImportUploadProgressItem[]>([]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsUploading(true);
      setProgress(
        files.map((file) => ({
          filename: file.name,
          status: "pending",
        }))
      );

      let successCount = 0;
      let nextIndex = 0;

      const uploadOne = async (file: File, index: number) => {
        setProgress((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "uploading" } : item
          )
        );

        const formData = new FormData();
        formData.set("file", file);
        if (sourceName.trim()) {
          formData.set("source_name", sourceName.trim());
        }

        const result = await uploadCreatorImportFileAction(formData);

        if (result.ok) {
          successCount += 1;
          setProgress((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, status: "success", message: result.message }
                : item
            )
          );
        } else {
          setProgress((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, status: "error", message: result.message }
                : item
            )
          );
          toast.error(result.message ?? `Failed to upload ${file.name}`);
        }
      };

      const worker = async () => {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= files.length) break;
          await uploadOne(files[index], index);
        }
      };

      const workerCount = Math.min(CREATOR_IMPORT_UPLOAD_CONCURRENCY, files.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      setIsUploading(false);

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "1 file uploaded successfully."
            : `${successCount} files uploaded successfully.`
        );
        await onUploadComplete?.();
      }
    },
    [onUploadComplete, sourceName]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      void uploadFiles(acceptedFiles);
    },
    accept: ACCEPT,
    multiple: true,
    disabled: isUploading,
    noClick: true,
    noKeyboard: true,
  });

  const completedCount = progress.filter((item) => item.status === "success").length;
  const errorCount = progress.filter((item) => item.status === "error").length;
  const uploadingCount = progress.filter((item) => item.status === "uploading").length;
  const overallPercent =
    progress.length === 0
      ? 0
      : Math.round(
          ((completedCount + errorCount + uploadingCount * 0.5) / progress.length) * 100
        );

  return (
    <div>
      <label
        htmlFor="source_name"
        className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground"
      >
        Source name (optional)
      </label>
      <Input
        id="source_name"
        value={sourceName}
        onChange={(event) => setSourceName(event.target.value)}
        placeholder="Agency, platform, or client name"
        disabled={isUploading}
        className="h-9 max-w-[340px] text-xs"
      />
      <p className="mt-1.5 mb-4 text-[11px] text-muted-foreground">
        Tag uploads with the dataset provider for easier filtering in history.
      </p>

      <div
        {...getRootProps()}
        className={cn(
          "group relative mb-5 cursor-pointer rounded-xl border-[1.5px] border-dashed bg-background px-8 py-12 text-center transition-colors",
          isDragActive
            ? "border-solid border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
            : "border-border hover:border-blue-600 hover:bg-blue-50/80 dark:hover:border-blue-500 dark:hover:bg-blue-950/20",
          isUploading && "pointer-events-none opacity-70"
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            "mx-auto mb-4 flex size-[52px] items-center justify-center rounded-[14px] border border-blue-200 bg-blue-50 transition-transform duration-200 dark:border-blue-800 dark:bg-blue-950/50",
            !isUploading && "group-hover:-translate-y-0.5"
          )}
        >
          {isUploading ? (
            <Loader2Icon className="size-6 animate-spin text-blue-600 dark:text-blue-400" />
          ) : (
            <UploadIcon className="size-6 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <p className="mb-1.5 text-sm font-semibold text-foreground">
          {isDragActive ? "Drop files to upload" : "Drag and drop creator datasets"}
        </p>
        <p className="mx-auto mb-4 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
          {CREATOR_IMPORT_FILE_EXTENSIONS.join(", ").toUpperCase()} — ZIP bundles may contain CSV
          or XLSX plus optional avatar images · multiple files · up to 50 MB each
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            open();
          }}
          disabled={isUploading}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-md border border-border bg-background px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-slate-300 hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          <FileIcon className="size-3.5" />
          Browse files
        </button>
      </div>

      {progress.length > 0 ? (
        <div className="mb-5 overflow-hidden rounded-[10px] border border-border bg-background">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs font-semibold text-foreground">Upload progress</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {overallPercent}%
            </span>
          </div>
          <div className="h-1 bg-slate-200 dark:bg-slate-800">
            <div
              className="relative h-full overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-500 ease-out"
              style={{ width: `${overallPercent}%` }}
            >
              <div className="absolute inset-0 animate-[import-shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>
          </div>
          <ul className="divide-y divide-border">
            {progress.map((item) => (
              <li
                key={item.filename}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {item.filename}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] font-semibold",
                    item.status === "success" && "text-emerald-600 dark:text-emerald-400",
                    item.status === "error" && "text-destructive",
                    item.status === "uploading" && "text-blue-600 dark:text-blue-400",
                    item.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {resolveProgressStatusText(item)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
