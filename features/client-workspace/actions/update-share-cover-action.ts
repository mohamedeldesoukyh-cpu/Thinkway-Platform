"use server";

import { randomUUID } from "node:crypto";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { requireStudioUser } from "@/features/campaign-studio/actions/persist-campaign-object-on-message";
import { loadSharePreview, SHARE_COVER_BUCKET } from "../share-preview-server";

export async function updateShareCoverAction(form: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const userDb = await createSupabaseServerClient();
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return { ok: false, message: "Sign in to change the link cover." };
    const preview = await loadSharePreview(String(form.get("reviewId") ?? ""), String(form.get("sign") ?? ""));
    if (!preview) return { ok: false, message: "This client link is unavailable." };
    // The signed link alone never authorizes edits; enforce internal permissions and row access.
    const { data: visible } = await userDb.from("campaign_client_reviews").select("id").eq("id", preview.review.id).maybeSingle();
    if (!visible) return { ok: false, message: "You do not have access to this review." };
    const source = preview.review.source;
    if (source === "studio") await requireStudioUser();
    else {
      const permission = source === "quotation" ? QUOTATION_PERMISSIONS.write
        : source === "shortlist" ? SHORTLIST_PERMISSIONS.write : "campaigns.write";
      const auth = await requirePermission(userDb, permission);
      if ("error" in auth) {
        if (source !== "quotation" || "error" in await requirePermission(userDb, QUOTATION_PERMISSIONS.admin)) {
          return { ok: false, message: "You do not have permission to change this cover." };
        }
      }
    }
    const db = createServiceRoleClient();
    if (form.get("remove") === "true") {
      const { error } = await db.from("client_review_share_covers").delete().eq("review_id", preview.ownerId);
      if (error) throw error;
      if (preview.coverPath) await db.storage.from(SHARE_COVER_BUCKET).remove([preview.coverPath]);
      return { ok: true, message: "Automatic campaign cover restored." };
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024
      || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { ok: false, message: "Choose a JPG, PNG or WebP image up to 5 MB." };
    }
    // Load native image processing only for an authorized upload, never when the
    // shared server-action registry loads for Finance or quotation requests.
    const { default: sharp } = await import("sharp");
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 })
      .rotate().resize(1200, 630, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
    const path = `${preview.ownerId}/${randomUUID()}.jpg`;
    const { error: uploadError } = await db.storage.from(SHARE_COVER_BUCKET).upload(path, image, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await db.from("client_review_share_covers").upsert({ review_id: preview.ownerId, storage_path: path, updated_at: new Date().toISOString() });
    if (error) {
      await db.storage.from(SHARE_COVER_BUCKET).remove([path]);
      throw error;
    }
    if (preview.coverPath) await db.storage.from(SHARE_COVER_BUCKET).remove([preview.coverPath]);
    return { ok: true, message: "Link cover updated. Copy and share the link again to request a fresh preview." };
  } catch {
    return { ok: false, message: "Could not update the cover. Check the image and try again." };
  }
}
