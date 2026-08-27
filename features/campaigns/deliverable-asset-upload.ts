import {
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  inferDeliverableAssetMime,
} from "@/lib/services/deliverables/documentation-types";

export type DeliverableUploadPhase = "preparing" | "uploading" | "finishing";

export type DeliverableUploadByteProgress = {
  loaded: number;
  total: number;
};

export function deliverableUploadPercent(loaded: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

export function formatDeliverableUploadBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function deliverableUploadMeterValue(input: {
  phase: DeliverableUploadPhase;
  loaded: number;
  total: number;
}): number {
  if (input.phase === "preparing") return 4;
  if (input.phase === "finishing") return 97;
  const filePercent = deliverableUploadPercent(input.loaded, input.total);
  return Math.min(95, Math.max(5, Math.round(5 + (filePercent * 90) / 100)));
}

export function deliverableUploadProgressLabel(input: {
  phase: DeliverableUploadPhase;
  fileName: string;
  loaded: number;
  total: number;
}): string {
  if (input.phase === "preparing") return `Preparing ${input.fileName}…`;
  if (input.phase === "finishing") return `Saving ${input.fileName}…`;
  if (input.loaded <= 0) return `Uploading ${input.fileName}…`;
  const percent = deliverableUploadPercent(input.loaded, input.total);
  return `Uploading ${input.fileName} · ${percent}% · ${formatDeliverableUploadBytes(input.loaded)} of ${formatDeliverableUploadBytes(input.total)}`;
}

export function deliverableUploadFailureMessage(
  status: number,
  responseText?: string | null
): string {
  if (status === 413) return DELIVERABLE_ASSET_TOO_LARGE_MESSAGE;
  if (status === 403) {
    return "You do not have permission to upload this file.";
  }
  if (status === 404) {
    return "The upload expired. Choose the file again.";
  }
  const body = (responseText ?? "").toLowerCase();
  if (
    status === 400 ||
    status === 415 ||
    body.includes("mime") ||
    body.includes("content-type") ||
    body.includes("not allowed")
  ) {
    return "Storage rejected this video type. Use MP4 or MOV under 100 MB.";
  }
  return "Could not upload the file. Try MP4 or MOV under 100 MB.";
}

export async function putDeliverableAssetToSignedUrl(input: {
  signedUrl: string;
  token: string;
  file: File;
  mimeType?: string | null;
  onProgress?: (progress: DeliverableUploadByteProgress) => void;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!/^https?:\/\//i.test(input.signedUrl)) {
    return { ok: false, message: "Could not start the file upload." };
  }

  const url = new URL(input.signedUrl);
  if (!url.searchParams.get("token") && input.token) {
    url.searchParams.set("token", input.token);
  }
  const contentType = inferDeliverableAssetMime(
    input.mimeType ?? input.file.type,
    input.file.name
  );

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url.toString());
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      input.onProgress?.({ loaded: event.loaded, total: event.total || input.file.size });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress?.({ loaded: input.file.size, total: input.file.size });
        resolve({ ok: true });
        return;
      }
      resolve({
        ok: false,
        message: deliverableUploadFailureMessage(xhr.status, xhr.responseText),
      });
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        message: "Could not upload the file. Check the connection and try again.",
      });
    };

    xhr.onabort = () => {
      resolve({ ok: false, message: "Upload cancelled." });
    };

    xhr.send(input.file);
  });
}
