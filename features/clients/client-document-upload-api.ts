export type ClientDocumentUploadApiResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function uploadClientDocumentViaApi(
  clientId: string,
  formData: FormData
): Promise<ClientDocumentUploadApiResult> {
  const response = await fetch(`/api/clients/${clientId}/documents`, {
    method: "POST",
    body: formData,
  });

  let payload: ClientDocumentUploadApiResult;
  try {
    payload = (await response.json()) as ClientDocumentUploadApiResult;
  } catch {
    return {
      ok: false,
      message: response.ok
        ? "Upload failed."
        : "Upload failed. The file may be too large or the server rejected the request.",
    };
  }

  if (!response.ok && !payload.message) {
    return { ok: false, message: "Upload failed." };
  }

  return payload;
}
