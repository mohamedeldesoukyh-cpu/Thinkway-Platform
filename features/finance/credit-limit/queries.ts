import { getClientCreditExposure } from "@/lib/finance/client-credit-exposure";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ClientCreditLimitRow, CreditLimitWorkspaceData } from "./types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  return supabase;
}

type ClientCreditLimitRecord = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  currency: string;
  credit_limit: number | null;
  credit_limit_active: boolean;
  accept_credit_risk: boolean;
};

export async function getCreditLimitWorkspace(): Promise<CreditLimitWorkspaceData> {
  const supabase = await requireUser();

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, document_number, name, legal_name, currency, credit_limit, credit_limit_active, accept_credit_risk"
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const records = (data ?? []) as ClientCreditLimitRecord[];

  const clients = await Promise.all(
    records.map(async (client): Promise<ClientCreditLimitRow> => {
      const exposureResult = await getClientCreditExposure(supabase, client.id);
      const limit =
        client.credit_limit != null ? roundMoney(Number(client.credit_limit)) : null;
      const exposure = exposureResult.exposure;
      const available =
        limit != null ? roundMoney(Math.max(0, limit - exposure)) : null;

      return {
        id: client.id,
        document_number: client.document_number,
        name: client.name,
        legal_name: client.legal_name,
        currency: client.currency ?? exposureResult.currency,
        credit_limit: limit,
        credit_limit_active: Boolean(client.credit_limit_active),
        accept_credit_risk: Boolean(client.accept_credit_risk),
        exposure,
        available,
      };
    })
  );

  return {
    clients,
    total: clients.length,
  };
}
