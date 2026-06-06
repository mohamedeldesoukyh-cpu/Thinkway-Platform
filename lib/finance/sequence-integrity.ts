import type { SupabaseClient } from "@supabase/supabase-js";

const INV_PREFIX_PATTERN = /^INV-(\d{4})-(\d+)$/;

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
  return `INV-${year}-${String(serial).padStart(5, "0")}`;
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
