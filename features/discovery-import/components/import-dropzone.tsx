"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileUpIcon, Loader2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { uploadCreatorImportFileAction } from "@/features/discovery-import/actions";
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

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
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
      }

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
  const overallPercent =
    progress.length === 0
      ? 0
      : Math.round(
          ((completedCount +
            progress.filter((item) => item.status === "error").length) /
            progress.length) *
            100
        );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:max-w-md">
        <Label htmlFor="source_name">Source name (optional)</Label>
        <Input
          id="source_name"
          value={sourceName}
          onChange={(event) => setSourceName(event.target.value)}
          placeholder="Agency, platform, or client name"
          disabled={isUploading}
        />
        <p className="text-xs text-muted-foreground">
          Tag uploads with the dataset provider for easier filtering in history.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
          isUploading && "pointer-events-none opacity-70"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isUploading ? (
            <Loader2Icon className="size-6 animate-spin" />
          ) : (
            <UploadCloudIcon className="size-6" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isDragActive ? "Drop files to upload" : "Drag and drop creator datasets"}
          </p>
          <p className="text-xs text-muted-foreground">
            {CREATOR_IMPORT_FILE_EXTENSIONS.join(", ").toUpperCase()} · multiple files · up to
            50 MB each
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={open} disabled={isUploading}>
          <FileUpIcon data-icon="inline-start" />
          Browse files
        </Button>
      </div>

      {progress.length > 0 ? (
        <div className="space-y-3 rounded-3xl border border-border p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Upload progress</span>
            <span className="text-muted-foreground">{overallPercent}%</span>
          </div>
          <Progress value={overallPercent} />
          <ul className="space-y-2 text-sm">
            {progress.map((item) => (
              <li
                key={item.filename}
                className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2"
              >
                <span className="truncate">{item.filename}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium",
                    item.status === "success" && "text-emerald-600",
                    item.status === "error" && "text-destructive",
                    item.status === "uploading" && "text-primary",
                    item.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {item.status === "uploading" ? "Uploading…" : item.message ?? item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
