"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/forms/field-error";
import type { DocumentUploadFormState } from "@/lib/domains/document/types";

export type { DocumentUploadFormState } from "@/lib/domains/document/types";

type DocumentUploadFormProps = {
  entityId: string;
  documentTypeOptions: readonly { value: string; label: string }[];
  /** Prefer `uploadDocument` for files that may exceed the 1 MB server action limit. */
  action?: (
    prevState: DocumentUploadFormState,
    formData: FormData
  ) => Promise<DocumentUploadFormState>;
  uploadDocument?: (
    entityId: string,
    formData: FormData
  ) => Promise<DocumentUploadFormState>;
  defaultDocumentType?: string;
};

export function DocumentUploadForm({
  entityId,
  documentTypeOptions,
  action,
  uploadDocument,
  defaultDocumentType,
}: DocumentUploadFormProps) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState(
    defaultDocumentType ?? documentTypeOptions[0]?.value ?? ""
  );
  const [state, setState] = useState<DocumentUploadFormState>({ ok: false });
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("document_type", documentType);

    setIsPending(true);
    try {
      if (uploadDocument) {
        setState(await uploadDocument(entityId, formData));
        return;
      }

      if (!action) {
        setState({ ok: false, message: "Upload handler is not configured." });
        return;
      }

      setState(await action({ ok: false }, formData));
    } finally {
      setIsPending(false);
      form.reset();
      setDocumentType(defaultDocumentType ?? documentTypeOptions[0]?.value ?? "");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-3xl border border-border p-4"
    >
      <input type="hidden" name="entity_id" value={entityId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="document_type">Document type</Label>
          <Select
            value={documentType}
            onValueChange={setDocumentType}
            disabled={isPending}
          >
            <SelectTrigger id="document_type" className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {documentTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={state.fieldErrors?.document_type} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="expires_at">Expiry (optional)</Label>
          <Input
            id="expires_at"
            name="expires_at"
            type="date"
            disabled={isPending}
          />
          <FieldError messages={state.fieldErrors?.expires_at} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="file">File</Label>
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          disabled={isPending}
        />
        <FieldError messages={state.fieldErrors?.file} />
        <p className="text-xs text-muted-foreground">
          PDF, images, or Word documents up to 50 MB.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}
