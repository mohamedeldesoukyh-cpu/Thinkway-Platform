type LockClient = {
  rpc: (name: string, args: { p_quotation_id: string; p_token: string }) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

/** The lease outlives the server request timeout; failed requests can be retried after expiry. */
export async function withQuotationConversionLock<T>(
  client: LockClient,
  quotationId: string,
  convert: () => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  const args = { p_quotation_id: quotationId, p_token: crypto.randomUUID() };
  const acquired = await client.rpc("acquire_quotation_conversion", args);
  if (acquired.error) return { ok: false, message: acquired.error.message };
  if (acquired.data !== true) {
    return { ok: false, message: "This quotation is already being converted. Please wait for the current conversion to finish, then try again." };
  }
  try {
    return await convert();
  } finally {
    // A cleanup failure must not disguise a successful conversion or its original error.
    try {
      const released = await client.rpc("release_quotation_conversion", args);
      if (released.error) console.error("Quotation conversion lock release failed", released.error.message);
    } catch (error) {
      console.error("Quotation conversion lock release failed", error);
    }
  }
}
