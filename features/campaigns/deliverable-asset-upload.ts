import {
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  inferDeliverableAssetMime,
} from "@/lib/services/deliverables/documentation-types";

/**
 * Supabase standard (non-TUS) uploads cap at 50 MB regardless of bucket
 * `file_size_limit`. Stay under that so ~80 MB stories use resumable TUS.
 */
export const DELIVERABLE_STANDARD_UPLOAD_MAX_BYTES = 45 * 1024 * 1024;

/** Required by Supabase Storage TUS — do not change. */
export const DELIVERABLE_TUS_CHUNK_BYTES = 6 * 1024 * 1024;

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

export function shouldUseResumableDeliverableUpload(fileSize: number): boolean {
  return fileSize > DELIVERABLE_STANDARD_UPLOAD_MAX_BYTES;
}

export function parseDeliverableSignedUploadTarget(signedUrl: string): {
  bucket: string;
  storagePath: string;
} | null {
  let url: URL;
  try {
    url = new URL(signedUrl);
  } catch {
    return null;
  }
  const marker = "/object/upload/sign/";
  const idx = url.pathname.indexOf(marker);
  if (idx < 0) return null;
  const rest = url.pathname.slice(idx + marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = decodeURIComponent(rest.slice(0, slash));
  const storagePath = decodeURIComponent(rest.slice(slash + 1));
  if (!bucket || !storagePath) return null;
  return { bucket, storagePath };
}

export function deliverableResumableSignedEndpoint(signedUrl: string): string {
  const url = new URL(signedUrl);
  const host = url.hostname;
  if (host.endsWith(".supabase.co") && !host.includes("storage.")) {
    const projectRef = host.split(".")[0];
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`;
  }
  return `${url.origin}/storage/v1/upload/resumable/sign`;
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
  bucket?: string | null;
  storagePath?: string | null;
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

  const result = shouldUseResumableDeliverableUpload(input.file.size)
    ? await putFileViaResumableUpload({
        signedUrl: input.signedUrl,
        token: input.token,
        file: input.file,
        contentType,
        bucket: input.bucket ?? null,
        storagePath: input.storagePath ?? null,
        onProgress: input.onProgress,
      })
    : await putFileToSignedUrl({
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

function publicStorageGatewayHeaders(): Record<string, string> {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!key) return {};
  return { apikey: key, authorization: `Bearer ${key}` };
}

function readTusFailure(error: unknown): { status: number; body: string } {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      originalResponse?: {
        getStatus?: () => number;
        getBody?: () => string;
      } | null;
    };
    const status = candidate.originalResponse?.getStatus?.() ?? 0;
    const body =
      candidate.originalResponse?.getBody?.() || candidate.message || "";
    return { status, body };
  }
  return { status: 0, body: String(error) };
}

async function putFileViaResumableUpload(input: {
  signedUrl: string;
  token: string;
  file: File;
  contentType: string;
  bucket: string | null;
  storagePath: string | null;
  onProgress?: (progress: DeliverableUploadByteProgress) => void;
}): Promise<PutResult> {
  const target =
    input.bucket && input.storagePath
      ? { bucket: input.bucket, storagePath: input.storagePath }
      : parseDeliverableSignedUploadTarget(input.signedUrl);
  if (!target) {
    return { ok: false, status: 0, body: "Could not start the file upload." };
  }

  const tus = await import("tus-js-client");
  return new Promise((resolve) => {
    const upload = new tus.Upload(input.file, {
      endpoint: deliverableResumableSignedEndpoint(input.signedUrl),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        ...publicStorageGatewayHeaders(),
        "x-signature": input.token,
        "x-upsert": "false",
      },
      metadata: {
        bucketName: target.bucket,
        objectName: target.storagePath,
        contentType: input.contentType,
        cacheControl: "3600",
      },
      chunkSize: DELIVERABLE_TUS_CHUNK_BYTES,
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      onError(error) {
        const failure = readTusFailure(error);
        resolve({ ok: false, status: failure.status, body: failure.body });
      },
      onProgress(bytesUploaded, bytesTotal) {
        input.onProgress?.({
          loaded: bytesUploaded,
          total: bytesTotal || input.file.size,
        });
      },
      onSuccess() {
        input.onProgress?.({ loaded: input.file.size, total: input.file.size });
        resolve({ ok: true });
      },
    });
    upload.start();
  });
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
