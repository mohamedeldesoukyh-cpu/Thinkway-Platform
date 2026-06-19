import type { SupabaseClient } from "@supabase/supabase-js";

export type IoDocumentBucket = "vendor-io-documents" | "client-io-documents";

const DEFAULT_SIGNED_URL_SECONDS = 60 * 15;
const EMAIL_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

export function buildIoDocumentStoragePath(ioId: string, fileName: string): string {
  return `${ioId}/${fileName}`;
}

export function resolveIoDocumentStoragePath(
  storedValue: string | null | undefined,
  bucket: IoDocumentBucket
): string | null {
  if (!storedValue?.trim()) return null;

  const trimmed = storedValue.trim();
  if (!trimmed.includes("://")) {
    return trimmed;
  }

  const markers = [
    `/object/public/${bucket}/`,
    `/object/sign/${bucket}/`,
    `/object/authenticated/${bucket}/`,
  ];

  for (const marker of markers) {
    const index = trimmed.indexOf(marker);
    if (index === -1) continue;
    const rawPath = trimmed.slice(index + marker.length).split("?")[0];
    return decodeURIComponent(rawPath);
  }

  return null;
}

export async function createIoDocumentSignedUrl(
  supabase: SupabaseClient,
  bucket: IoDocumentBucket,
  storedValue: string | null | undefined,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_SECONDS
): Promise<string | null> {
  const path = resolveIoDocumentStoragePath(storedValue, bucket);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function downloadIoDocumentBuffer(
  supabase: SupabaseClient,
  bucket: IoDocumentBucket,
  storedValue: string | null | undefined
): Promise<Buffer | null> {
  const path = resolveIoDocumentStoragePath(storedValue, bucket);
  if (!path) return null;

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;

  return Buffer.from(await data.arrayBuffer());
}

export { EMAIL_SIGNED_URL_SECONDS };
