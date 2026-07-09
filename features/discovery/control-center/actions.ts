"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import {
  invalidateDiscoveryControlSettingsCache,
  updateDiscoveryControlSettings,
} from "@/lib/discovery/control-center/discovery-control-service";
import type { DiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DiscoverySettingsActionState = {
  ok: boolean;
  message?: string;
};

async function requireDiscoveryAdmin() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.admin");
  if ("error" in auth) {
    return { supabase, userId: null, error: auth.error };
  }
  return { supabase, userId: auth.userId, error: null };
}

function parseBoolean(value: FormDataEntryValue | null, fallback: boolean): boolean {
  if (value == null) return fallback;
  const raw = String(value).trim().toLowerCase();
  if (raw === "true" || raw === "on" || raw === "1") return true;
  if (raw === "false" || raw === "off" || raw === "0") return false;
  return fallback;
}

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function updateDiscoveryControlSettingsAction(
  _prev: DiscoverySettingsActionState,
  formData: FormData
): Promise<DiscoverySettingsActionState> {
  const { supabase, userId, error } = await requireDiscoveryAdmin();
  if (error || !userId) {
    return { ok: false, message: error ?? "Unauthorized" };
  }

  const dataFreshnessRaw = String(formData.get("dataFreshnessDays") ?? "").trim();
  const dataFreshnessDays =
    dataFreshnessRaw === "7" || dataFreshnessRaw === "30" || dataFreshnessRaw === "90"
      ? (Number(dataFreshnessRaw) as 7 | 30 | 90)
      : null;

  const settings: DiscoveryControlSettings = {
    discoverySource: String(formData.get("discoverySource") ?? "hybrid") as DiscoveryControlSettings["discoverySource"],
    searchPriority: String(formData.get("searchPriority") ?? "database_first") as DiscoveryControlSettings["searchPriority"],
    coverageThreshold: Math.max(0, Math.min(100, parseNumber(formData.get("coverageThreshold"), 80))),
    automaticEnrichment: String(formData.get("automaticEnrichment") ?? "never") as DiscoveryControlSettings["automaticEnrichment"],
    dnaPolicy: {
      generateAfterImport: formData.has("dnaGenerateAfterImport"),
      updateAfterEnrichment: formData.has("dnaUpdateAfterEnrichment"),
      calculateCompleteness: formData.has("dnaCalculateCompleteness"),
    },
    dataFreshnessDays,
    costProtection: {
      maxRequestsPerDay: Math.max(0, parseNumber(formData.get("maxRequestsPerDay"), 0)),
      maxCreditsPerDay: Math.max(0, parseNumber(formData.get("maxCreditsPerDay"), 0)),
      confirmBeforeExceed: formData.has("confirmBeforeExceed"),
    },
  };

  const result = await updateDiscoveryControlSettings(supabase, settings, userId);
  if (!result.ok) {
    return { ok: false, message: result.error ?? "Failed to save settings." };
  }

  invalidateDiscoveryControlSettingsCache();
  revalidatePath("/settings/discovery-engine");
  revalidatePath("/settings/discovery-diagnostics");
  return { ok: true, message: "Discovery control settings saved." };
}
