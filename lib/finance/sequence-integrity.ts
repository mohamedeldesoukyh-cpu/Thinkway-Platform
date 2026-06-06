import type { SupabaseClient } from "@supabase/supabase-js";

const INV_PREFIX_PATTERN = /^INV-(\d{4})-(\d+)$/;

export type InvoiceSequenceRepairResult = {
  year: number;
  renumbered: number;
  previous_max_serial: number;
  new_max_serial: number;
  next_serial: number;
};

export type InvoiceSequenceRepairPreviewRow = {
  invoice_id: string | null;
  old_document_number: string | null;
  new_document_number: string | null;
};

export type InvoiceSequenceValidation = {
  year: number;
  prefix: string;
  sequence_last_value: number;
  max_existing_serial: number;
  next_would_be: number;
  invoice_count: number;
  is_valid: boolean;
  drift: number;
  message: string;
};

export function parseInvoiceDocumentNumber(
  documentNumber: string
): { year: number; serial: number } | null {
  const match = documentNumber.trim().match(INV_PREFIX_PATTERN);
  if (!match) return null;
  return {
    year: Number(match[1]),
    serial: Number(match[2]),
  };
}

export function formatInvoiceDocumentNumber(year: number, serial: number): string {
  return `INV-${year}-${serial}`;
}

export function maxInvoiceSerialFromNumbers(documentNumbers: string[]): number {
  let max = 0;
  for (const doc of documentNumbers) {
    const parsed = parseInvoiceDocumentNumber(doc);
    if (parsed && parsed.serial > max) max = parsed.serial;
  }
  return max;
}

export function getNextInvoiceNumber(input: {
  year?: number;
  sequence_last_value: number;
  max_existing_serial: number;
}): string {
  const year = input.year ?? new Date().getUTCFullYear();
  const nextSerial = Math.max(input.sequence_last_value, input.max_existing_serial) + 1;
  return formatInvoiceDocumentNumber(year, nextSerial);
}

export function validateInvoiceSequence(input: {
  year: number;
  sequence_last_value: number;
  invoice_document_numbers: string[];
}): InvoiceSequenceValidation {
  const prefix = `INV-${input.year}`;
  const max_existing_serial = maxInvoiceSerialFromNumbers(
    input.invoice_document_numbers.filter((doc) => doc.startsWith(`${prefix}-`))
  );
  const next_would_be = Math.max(input.sequence_last_value, max_existing_serial) + 1;
  const drift = input.sequence_last_value - max_existing_serial;
  const is_valid = input.sequence_last_value >= max_existing_serial;

  return {
    year: input.year,
    prefix,
    sequence_last_value: input.sequence_last_value,
    max_existing_serial,
    next_would_be,
    invoice_count: input.invoice_document_numbers.filter((doc) =>
      doc.startsWith(`${prefix}-`)
    ).length,
    is_valid,
    drift,
    message: is_valid
      ? `Next invoice: ${formatInvoiceDocumentNumber(input.year, next_would_be)}`
      : `Sequence ahead of invoices by ${drift}. Run repairInvoiceSequences().`,
  };
}

/** Compact surviving invoice serials to 1..N and reseed sequence (server-side RPC). */
export async function repairInvoiceSequenceForYear(
  supabase: SupabaseClient,
  year: number,
  options?: { dryRun?: boolean }
): Promise<{
  ok: boolean;
  result?: InvoiceSequenceRepairResult;
  preview?: InvoiceSequenceRepairPreviewRow[];
  error?: string;
}> {
  const dryRun = options?.dryRun ?? false;
  const { data, error } = await supabase.rpc("repair_invoice_sequence_for_year", {
    p_year: year,
    p_dry_run: dryRun,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return { ok: true };
  }

  const preview: InvoiceSequenceRepairPreviewRow[] = rows
    .filter((row) => row.invoice_id)
    .map((row) => ({
      invoice_id: row.invoice_id ? String(row.invoice_id) : null,
      old_document_number: row.old_document_number ? String(row.old_document_number) : null,
      new_document_number: row.new_document_number ? String(row.new_document_number) : null,
    }));

  const summary = rows[rows.length - 1];
  return {
    ok: true,
    preview: dryRun ? preview : undefined,
    result: {
      year,
      renumbered: preview.length,
      previous_max_serial: Number(summary.previous_max_serial ?? 0),
      new_max_serial: Number(summary.new_max_serial ?? 0),
      next_serial: Number(summary.next_serial ?? 0),
    },
  };
}

/** Align INV-YYYY document_sequences with surviving invoices (server-side RPC). */
export async function repairInvoiceSequences(
  supabase: SupabaseClient,
  options?: { year?: number; dryRun?: boolean }
): Promise<{ ok: boolean; rows: Record<string, unknown>[]; error?: string }> {
  const { data, error } = await supabase.rpc("reseed_invoice_document_sequences", {
    p_year: options?.year ?? null,
    p_dry_run: options?.dryRun ?? false,
  });

  if (error) {
    return { ok: false, rows: [], error: error.message };
  }

  return { ok: true, rows: (data ?? []) as Record<string, unknown>[] };
}

/** Load sequence + invoices and validate without mutating. */
export async function auditInvoiceSequence(
  supabase: SupabaseClient,
  year?: number
): Promise<InvoiceSequenceValidation[]> {
  const targetYear = year ?? new Date().getUTCFullYear();
  const prefix = `INV-${targetYear}`;

  const [{ data: sequences }, { data: invoices }] = await Promise.all([
    supabase.from("document_sequences").select("prefix, last_value").eq("prefix", prefix).maybeSingle(),
    supabase
      .from("invoices")
      .select("document_number")
      .like("document_number", `${prefix}-%`),
  ]);

  const seqRow = sequences as { last_value?: number } | null;
  const numbers = (invoices ?? []).map((row) => String((row as { document_number: string }).document_number));

  return [
    validateInvoiceSequence({
      year: targetYear,
      sequence_last_value: Number(seqRow?.last_value ?? 0),
      invoice_document_numbers: numbers,
    }),
  ];
}
