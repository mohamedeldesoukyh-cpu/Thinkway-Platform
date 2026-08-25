"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { clearEntityLogoAction, uploadEntityLogoAction } from "@/features/entity-logos/actions";
import type { EntityLogoKind } from "@/lib/entity-logos/identity-logo";

export function EntityLogoField({
  kind,
  entityId,
  logoUrl,
  label = "Logo",
  hint = "PNG, JPG, or WebP · up to 2 MB. Client Workspace and Client Portal show the group logo first, then the client logo when there is no group.",
  disabled,
  onLogoUrlChange,
}: {
  kind: EntityLogoKind;
  entityId: string;
  logoUrl?: string | null;
  label?: string;
  hint?: string;
  disabled?: boolean;
  onLogoUrlChange?: (logoUrl: string | null) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(logoUrl ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPreviewUrl(logoUrl ?? null);
  }, [logoUrl]);

  function submit(formData: FormData, mode: "upload" | "clear") {
    startTransition(async () => {
      const result = mode === "upload" ? await uploadEntityLogoAction(formData) : await clearEntityLogoAction(formData);
      if (!result.ok) {
        toast.error(result.message ?? "Logo update failed.");
        return;
      }
      setPreviewUrl(result.logoUrl ?? null);
      onLogoUrlChange?.(result.logoUrl ?? null);
      toast.success(result.message ?? "Logo updated.");
      if (inputRef.current) inputRef.current.value = "";
      if (!onLogoUrlChange) router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-contain p-1" />
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">No logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={disabled || pending || !entityId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const formData = new FormData();
              formData.set("kind", kind);
              formData.set("entity_id", entityId);
              formData.set("file", file);
              submit(formData, "upload");
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || pending || !entityId}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Uploading…" : previewUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || pending}
              onClick={() => {
                const formData = new FormData();
                formData.set("kind", kind);
                formData.set("entity_id", entityId);
                submit(formData, "clear");
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
