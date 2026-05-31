"use client";

import { useActionState, useEffect, useState } from "react";
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

export type DocumentUploadFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

type DocumentUploadFormProps = {
  entityId: string;
  documentTypeOptions: readonly { value: string; label: string }[];
  action: (
    prevState: DocumentUploadFormState,
    formData: FormData
  ) => Promise<DocumentUploadFormState>;
  defaultDocumentType?: string;
};

export function DocumentUploadForm({
  entityId,
  documentTypeOptions,
  action,
  defaultDocumentType,
}: DocumentUploadFormProps) {
  const [documentType, setDocumentType] = useState(
    defaultDocumentType ?? documentTypeOptions[0]?.value ?? ""
  );

  const [state, formAction, isPending] = useActionState(action, {
    ok: false,
  });

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 rounded-3xl border border-border p-4">
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="document_type" value={documentType} />
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
