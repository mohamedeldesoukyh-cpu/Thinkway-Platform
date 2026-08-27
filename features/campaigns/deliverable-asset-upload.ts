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
  const body = (responseText ?? "").toLowerCase();
  if (body.includes("aborted")) return "Upload cancelled.";
  if (status === 0) {
    return "Could not upload the file. Check the connection and try again.";
  }
  if (
    status === 413 ||
    body.includes("too large") ||
    body.includes("maximum allowed size") ||
    body.includes("payload too large") ||
    body.includes("file_size_limit")
  ) {
    return DELIVERABLE_ASSET_TOO_LARGE_MESSAGE;
  }
  if (status === 403) {
    return "You do not have permission to upload this file.";
  }
  if (status === 404) {
    return "The upload expired. Choose the file again.";
  }
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

export function isDeliverableStoragePutSuccess(status: number): boolean {
  return (status >= 200 && status < 300) || status === 409;
}

function isMimeRejection(status: number, responseText?: string | null): boolean {
  if (status === 415) return true;
  const body = (responseText ?? "").toLowerCase();
  if (body.includes("too large") || body.includes("payload")) return false;
  return (
    status === 400 &&
    (body.includes("mime") ||
      body.includes("content-type") ||
      body.includes("not allowed") ||
      body.includes("invalid"))
  );
}

type PutResult =
  | { ok: true }
  | { ok: false; status: number; body: string };

export type DeliverableSignedPutResult =
  | { ok: true; mimeType: string }
  | { ok: false; message: string; mimeRejected?: boolean };

export async function putDeliverableAssetToSignedUrl(input: {
  signedUrl: string;
  token: string;
  file: File;
  mimeType?: string | null;
  onProgress?: (progress: DeliverableUploadByteProgress) => void;
}): Promise<DeliverableSignedPutResult> {
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

  const result = await putFileToSignedUrl({
    url: url.toString(),
    token: input.token,
    file: input.file,
    contentType,
    onProgress: input.onProgress,
  });
  if (result.ok) return { ok: true, mimeType: contentType };

  return {
    ok: false,
    message: deliverableUploadFailureMessage(result.status, result.body),
    mimeRejected: isMimeRejection(result.status, result.body),
  };
}

function putFileToSignedUrl(input: {
  url: string;
  token: string;
  file: File;
  contentType: string;
  onProgress?: (progress: DeliverableUploadByteProgress) => void;
}): Promise<PutResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", input.url);
    xhr.setRequestHeader("Content-Type", input.contentType);
    xhr.setRequestHeader("x-upsert", "false");
    if (input.token) {
      xhr.setRequestHeader("Authorization", `Bearer ${input.token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      input.onProgress?.({ loaded: event.loaded, total: event.total || input.file.size });
    };

    xhr.onload = () => {
      if (isDeliverableStoragePutSuccess(xhr.status)) {
        input.onProgress?.({ loaded: input.file.size, total: input.file.size });
        resolve({ ok: true });
        return;
      }
      resolve({
        ok: false,
        status: xhr.status,
        body: xhr.responseText ?? "",
      });
    };

    xhr.onerror = () => {
      resolve({ ok: false, status: 0, body: "network" });
    };

    xhr.onabort = () => {
      resolve({ ok: false, status: 0, body: "aborted" });
    };

    xhr.send(input.file);
  });
}
