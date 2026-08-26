import { DELIVERABLE_ASSET_TOO_LARGE_MESSAGE } from "@/lib/services/deliverables/documentation-types";

export async function putDeliverableAssetToSignedUrl(input: {
  signedUrl: string;
  token: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!/^https?:\/\//i.test(input.signedUrl)) {
    return { ok: false, message: "Could not start the file upload." };
  }

  const url = new URL(input.signedUrl);
  if (!url.searchParams.get("token") && input.token) {
    url.searchParams.set("token", input.token);
  }

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": input.file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: input.file,
  });

  if (!response.ok) {
    return {
      ok: false,
      message:
        response.status === 413
          ? DELIVERABLE_ASSET_TOO_LARGE_MESSAGE
          : "Could not upload the file. Try MP4 or MOV under 100 MB.",
    };
  }

  return { ok: true };
}
