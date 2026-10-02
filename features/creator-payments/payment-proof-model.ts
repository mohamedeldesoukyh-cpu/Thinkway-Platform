export const PAYMENT_PROOF_BUCKET = 'creator-payment-proofs';
export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type PaymentProof = { id: string; file_name: string; mime_type: string; byte_size: number };
export function validatePaymentProof(file: { name: string; type: string; size: number }): string | null {
  if (!file.name.trim() || file.name.length > 180) return 'Use a file name between 1 and 180 characters.';
  if (!(PAYMENT_PROOF_TYPES as readonly string[]).includes(file.type)) return 'Choose a PDF, JPG, PNG or WebP file.';
  if (file.size <= 0 || file.size > PAYMENT_PROOF_MAX_BYTES) return 'Choose a file up to 10 MB.';
  return null;
}
