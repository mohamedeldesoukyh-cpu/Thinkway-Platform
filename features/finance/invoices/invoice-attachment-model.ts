export const INVOICE_ATTACHMENT_BUCKET = 'invoice-tax-attachments';
export const INVOICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const INVOICE_ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type InvoiceAttachment = { id: string; file_name: string; mime_type: string; byte_size: number };
export function validateInvoiceAttachment(file: { name: string; type: string; size: number }): string | null {
  if (!file.name.trim() || file.name.length > 180) return 'Use a file name between 1 and 180 characters.';
  if (!(INVOICE_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return 'Choose a PDF, JPG, PNG or WebP file.';
  if (file.size <= 0 || file.size > INVOICE_ATTACHMENT_MAX_BYTES) return 'Choose a file up to 10 MB.';
  return null;
}

